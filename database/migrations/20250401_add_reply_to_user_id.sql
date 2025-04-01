-- Add the reply_to_user_id column to the replies table
ALTER TABLE public.replies
ADD COLUMN reply_to_user_id UUID NULL;

-- Add a foreign key constraint to user_profiles table
ALTER TABLE public.replies
ADD CONSTRAINT fk_reply_to_user
FOREIGN KEY (reply_to_user_id)
REFERENCES public.user_profiles (id)
ON DELETE SET NULL; -- Or CASCADE, depending on desired behavior if a user profile is deleted

-- Optional: Add an index for performance
CREATE INDEX IF NOT EXISTS idx_replies_reply_to_user_id ON public.replies (reply_to_user_id);

COMMENT ON COLUMN public.replies.reply_to_user_id IS 'The user ID of the specific user this reply is directed towards in a thread.';
