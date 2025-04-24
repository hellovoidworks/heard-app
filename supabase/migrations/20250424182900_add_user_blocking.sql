-- Create user_blocks table
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Add indexes for faster lookups
CREATE INDEX idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked_id ON user_blocks(blocked_id);

-- Add row level security
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own blocks
CREATE POLICY user_blocks_select_policy ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

-- Only allow users to create blocks for themselves
CREATE POLICY user_blocks_insert_policy ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Only allow users to delete their own blocks
CREATE POLICY user_blocks_delete_policy ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Create function to block a user
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Don't allow users to block themselves
  IF auth.uid() = p_blocked_id THEN
    RETURN FALSE;
  END IF;

  -- Insert the block record
  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;
