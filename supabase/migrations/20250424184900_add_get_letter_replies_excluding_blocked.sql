-- Create a function to get letter replies excluding blocked users
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
  ORDER BY r.created_at ASC;
END;
$$;

-- Create a function to count replies for a letter excluding blocked users
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
  );
  
  RETURN reply_count;
END;
$$;
