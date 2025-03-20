-- Add a table for letter reactions
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user can only react once with each emoji type to a letter
    UNIQUE(user_id, letter_id, reaction_type)
);

-- Add RLS policies for reactions table
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Allow users to see all reactions
CREATE POLICY "Reactions are viewable by everyone" 
ON public.reactions FOR SELECT 
USING (true);

-- Users can only create reactions if they're authenticated
CREATE POLICY "Users can create reactions" 
ON public.reactions FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own reactions
CREATE POLICY "Users can update their own reactions" 
ON public.reactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own reactions
CREATE POLICY "Users can delete their own reactions" 
ON public.reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add function to notify when a reaction is created
CREATE OR REPLACE FUNCTION public.handle_new_reaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a notification for the letter author
  INSERT INTO public.notifications (recipient_id, type, related_id, actor_id)
  SELECT l.author_id, 'reaction', NEW.letter_id, NEW.user_id
  FROM public.letters l
  WHERE l.id = NEW.letter_id AND l.author_id != NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function whenever a new reaction is created
CREATE TRIGGER on_reaction_created
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_reaction(); 