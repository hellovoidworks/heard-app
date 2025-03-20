-- Create a new table for replies
CREATE TABLE IF NOT EXISTS public.replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    content TEXT NOT NULL,
    reply_to_id UUID REFERENCES public.replies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_replies_letter_id ON public.replies(letter_id);
CREATE INDEX IF NOT EXISTS idx_replies_author_id ON public.replies(author_id);
CREATE INDEX IF NOT EXISTS idx_replies_reply_to_id ON public.replies(reply_to_id);

-- Enable Row Level Security on replies table
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

-- Define RLS policies for replies
-- Anyone can view replies
CREATE POLICY "Replies are viewable by everyone" 
ON public.replies FOR SELECT USING (true);

-- Users can only create replies if they're authenticated
CREATE POLICY "Users can create replies" 
ON public.replies FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Users can only update their own replies
CREATE POLICY "Users can update their own replies" 
ON public.replies FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Users can only delete their own replies
CREATE POLICY "Users can delete their own replies" 
ON public.replies FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- Add trigger for updated_at column
CREATE TRIGGER set_updated_at_replies
BEFORE UPDATE ON public.replies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create a function to handle notifications for new replies
CREATE OR REPLACE FUNCTION public.handle_new_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a notification for the original letter author
  INSERT INTO public.notifications (recipient_id, type, related_id, actor_id)
  SELECT l.author_id, 'reply', NEW.letter_id, NEW.author_id
  FROM public.letters l
  WHERE l.id = NEW.letter_id AND l.author_id != NEW.author_id;
  
  -- If this is a reply to another reply, also notify that reply's author
  IF NEW.reply_to_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, related_id, actor_id)
    SELECT r.author_id, 'reply', NEW.letter_id, NEW.author_id
    FROM public.replies r
    WHERE r.id = NEW.reply_to_id AND r.author_id != NEW.author_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger for the handle_new_reply function
CREATE TRIGGER on_reply_created
AFTER INSERT ON public.replies
FOR EACH ROW EXECUTE FUNCTION public.handle_new_reply();

-- Create a view to track reply reads
CREATE TABLE IF NOT EXISTS public.reply_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reply_id UUID NOT NULL REFERENCES public.replies(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ensure each reply is only recorded once per user
    CONSTRAINT reply_reads_user_reply_unique UNIQUE (user_id, reply_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reply_reads_user_id ON public.reply_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_reads_reply_id ON public.reply_reads(reply_id);

-- Enable Row Level Security on reply_reads table
ALTER TABLE public.reply_reads ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for reply_reads
CREATE POLICY "Users can select their own reply reads" 
ON public.reply_reads FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reply reads" 
ON public.reply_reads FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add function to count unread replies for a letter
CREATE OR REPLACE FUNCTION get_unread_reply_count(p_user_id UUID, p_letter_ids UUID[])
RETURNS TABLE (letter_id UUID, unread_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.letter_id, COUNT(r.id)::BIGINT
  FROM public.replies r
  LEFT JOIN public.reply_reads rr ON r.id = rr.reply_id AND rr.user_id = p_user_id
  WHERE r.letter_id = ANY(p_letter_ids)
    AND r.author_id != p_user_id
    AND rr.id IS NULL
  GROUP BY r.letter_id;
END;
$$ LANGUAGE plpgsql; 