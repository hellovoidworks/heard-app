-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS get_letter_replies_excluding_blocked(UUID, UUID);

-- Update get_letter_replies_excluding_blocked to correctly handle all blocking scenarios
CREATE OR REPLACE FUNCTION get_letter_replies_excluding_blocked(
  p_letter_id UUID,
  p_user_id UUID
)
RETURNS SETOF replies
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM replies r
  WHERE r.letter_id = p_letter_id
  -- These two conditions exclude replies from/to users that the requesting user has blocked
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
  -- These two conditions exclude replies where the requesting user is blocked by someone
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
  )
  -- This final condition excludes any replies between users who have a blocking relationship
  -- Ensures conversation threads don't show up for either party
  AND NOT EXISTS (
    -- Check if there's any blocking relationship between the author and recipient
    SELECT 1 FROM user_blocks b
    WHERE (
      (b.blocker_id = r.author_id AND b.blocked_id = r.reply_to_user_id)
      OR
      (b.blocker_id = r.reply_to_user_id AND b.blocked_id = r.author_id)
    )
    AND r.reply_to_user_id IS NOT NULL
  )
  ORDER BY r.created_at ASC;
END;
$$;
