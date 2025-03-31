-- Create push_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);

-- Grant permissions
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to manage their own tokens
CREATE POLICY "Users can manage their own push tokens"
  ON public.push_tokens
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert and delete their tokens
GRANT SELECT, INSERT, DELETE ON public.push_tokens TO authenticated;
