-- Create reaction_reads table to track when users view reactions to their letters
CREATE TABLE IF NOT EXISTS public.reaction_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, letter_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS reaction_reads_user_id_idx ON public.reaction_reads(user_id);
CREATE INDEX IF NOT EXISTS reaction_reads_letter_id_idx ON public.reaction_reads(letter_id);

-- Enable row level security
ALTER TABLE public.reaction_reads ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view and manage their own reaction reads
-- This policy ensures users can only see and update reaction reads for letters they authored
CREATE POLICY "Users can manage reaction reads for their own letters"
  ON public.reaction_reads
  USING (
    user_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM public.letters 
      WHERE letters.id = reaction_reads.letter_id AND letters.author_id = auth.uid()
    )
  );

-- Allow authenticated users to select, insert, and update their reaction reads
GRANT SELECT, INSERT, UPDATE ON public.reaction_reads TO authenticated;

-- Create a function to mark all reactions on a letter as read
CREATE OR REPLACE FUNCTION public.mark_letter_reactions_as_read(
  letter_id_param UUID,
  user_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user is the author of the letter
  IF EXISTS (
    SELECT 1 FROM public.letters 
    WHERE id = letter_id_param AND author_id = user_id_param
  ) THEN
    -- Insert or update the reaction_reads record
    INSERT INTO public.reaction_reads (user_id, letter_id, last_viewed_at)
    VALUES (user_id_param, letter_id_param, NOW())
    ON CONFLICT (user_id, letter_id) 
    DO UPDATE SET last_viewed_at = NOW();
  END IF;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_letter_reactions_as_read TO authenticated;
