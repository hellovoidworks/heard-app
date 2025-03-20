-- Update foreign key relationships for the replies table
-- This will create a proper connection between replies.author_id and user_profiles.id

-- First, ensure we have the right constraint on author_id
ALTER TABLE public.replies 
  DROP CONSTRAINT IF EXISTS replies_author_id_fkey;

-- Add the foreign key constraint that links to user_profiles instead of auth.users
ALTER TABLE public.replies
  ADD CONSTRAINT replies_author_id_fkey 
  FOREIGN KEY (author_id) 
  REFERENCES public.user_profiles(id) 
  ON DELETE CASCADE;

-- Add a comment to make this relationship clear for PostgREST
COMMENT ON CONSTRAINT replies_author_id_fkey ON public.replies IS 
  'The author_id references the id in user_profiles'; 