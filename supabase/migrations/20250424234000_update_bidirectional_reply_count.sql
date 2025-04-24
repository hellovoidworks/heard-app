-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS count_letter_replies_excluding_blocked(UUID, UUID);

-- Update count_letter_replies_excluding_blocked to handle bidirectional blocking
CREATE OR REPLACE FUNCTION count_letter_replies_excluding_blocked(
  p_letter_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  reply_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO reply_count
  FROM replies r
  WHERE r.letter_id = p_letter_id
  AND NOT EXISTS (
    -- Check if the reply author is blocked by the requesting user
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = p_user_id
    AND b.blocked_id = r.author_id
  )
  AND NOT EXISTS (
    -- Check if the reply recipient is blocked by the requesting user
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = p_user_id
    AND b.blocked_id = r.reply_to_user_id
    AND r.reply_to_user_id IS NOT NULL
  )
  -- Add bidirectional blocking checks
  AND NOT EXISTS (
    -- Check if the requesting user is blocked by the reply author
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = r.author_id
    AND b.blocked_id = p_user_id
  )
  AND NOT EXISTS (
    -- Check if the requesting user is blocked by the reply recipient
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = r.reply_to_user_id
    AND b.blocked_id = p_user_id
    AND r.reply_to_user_id IS NOT NULL
  );
  
  RETURN reply_count;
END;
$$;
