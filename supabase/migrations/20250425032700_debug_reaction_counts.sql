-- Create diagnostic function to debug reaction counting
CREATE OR REPLACE FUNCTION debug_reaction_count(
  p_letter_id UUID, 
  p_user_id UUID
)
RETURNS TABLE (
  count_type TEXT,
  count_value BIGINT,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  blocked_by_user BIGINT;
  blocked_user BIGINT;
  total_reactions BIGINT;
  filtered_reactions BIGINT;
BEGIN
  -- Count total reactions for the letter
  SELECT COUNT(*) INTO total_reactions
  FROM reactions
  WHERE letter_id = p_letter_id;
  
  count_type := 'total_reactions';
  count_value := total_reactions;
  details := 'All reactions for the letter';
  RETURN NEXT;
  
  -- Count reactions by users the specified user has blocked
  SELECT COUNT(*) INTO blocked_by_user
  FROM reactions r
  WHERE r.letter_id = p_letter_id
  AND EXISTS (
    -- User has blocked the reaction author
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = p_user_id
    AND b.blocked_id = r.user_id
  );
  
  count_type := 'blocked_by_user';
  count_value := blocked_by_user;
  details := 'Reactions from users that this user has blocked';
  RETURN NEXT;
  
  -- Count reactions by users who have blocked the specified user
  SELECT COUNT(*) INTO blocked_user
  FROM reactions r
  WHERE r.letter_id = p_letter_id
  AND EXISTS (
    -- Reaction author has blocked the user
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = r.user_id
    AND b.blocked_id = p_user_id
  );
  
  count_type := 'blocked_user';
  count_value := blocked_user;
  details := 'Reactions from users who have blocked this user';
  RETURN NEXT;
  
  -- Count filtered reactions (what should be shown)
  SELECT COUNT(*) INTO filtered_reactions
  FROM reactions r
  WHERE r.letter_id = p_letter_id
  AND NOT EXISTS (
    -- User has not blocked the reaction author
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = p_user_id
    AND b.blocked_id = r.user_id
  )
  AND NOT EXISTS (
    -- Reaction author has not blocked the user
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = r.user_id
    AND b.blocked_id = p_user_id
  );
  
  count_type := 'filtered_reactions';
  count_value := filtered_reactions;
  details := 'Reactions that should be shown after filtering';
  RETURN NEXT;
  
  -- Also return the details of all reactions for debugging
  RETURN;
END;
$$;

-- Create a function to examine detailed reaction information
CREATE OR REPLACE FUNCTION get_detailed_reactions(
  p_letter_id UUID
)
RETURNS TABLE (
  reaction_id UUID,
  reaction_type TEXT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  username TEXT,
  is_blocked BOOLEAN,
  is_blocker BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.reaction_type,
    r.created_at,
    r.user_id,
    up.username,
    EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE b.blocker_id = '${p_user_id}'
      AND b.blocked_id = r.user_id
    ) AS is_blocked,
    EXISTS (
      SELECT 1 FROM user_blocks b 
      WHERE b.blocker_id = r.user_id
      AND b.blocked_id = '${p_user_id}'
    ) AS is_blocker
  FROM 
    reactions r
  JOIN 
    user_profiles up ON r.user_id = up.id
  WHERE 
    r.letter_id = p_letter_id
  ORDER BY 
    r.created_at DESC;
END;
$$;
