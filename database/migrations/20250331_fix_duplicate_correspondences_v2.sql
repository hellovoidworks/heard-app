-- Migration to fix duplicate correspondences in the get_user_correspondences function
-- This version fixes the ambiguous column reference error

CREATE OR REPLACE FUNCTION get_user_correspondences(p_user_id UUID)
RETURNS TABLE (
  letter_id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  author_id UUID,
  most_recent_activity_date TIMESTAMPTZ,
  most_recent_content TEXT,
  unread_count BIGINT,
  participants TEXT[],
  category_name TEXT,
  category_color TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_authored_letters AS (
    SELECT l.id AS letter_id
    FROM public.letters l
    WHERE l.author_id = p_user_id
  ),
  user_replied_letters AS (
    SELECT DISTINCT r.letter_id AS letter_id
    FROM public.replies r
    WHERE r.author_id = p_user_id
  ),
  user_reacted_letters AS (
    SELECT DISTINCT rc.letter_id AS letter_id
    FROM public.reactions rc
    WHERE rc.user_id = p_user_id
  ),
  -- Combine all letter interactions to avoid duplicates
  user_interacted_letters AS (
    SELECT url.letter_id AS letter_id 
    FROM user_replied_letters url
    UNION
    SELECT urc.letter_id AS letter_id 
    FROM user_reacted_letters urc
  ),
  relevant_letters AS (
    -- Letters authored by the user
    SELECT 
      l.id AS letter_id, 
      l.title AS title, 
      l.content AS content, 
      l.created_at AS created_at, 
      l.author_id AS author_id, 
      'authored' AS relationship
    FROM public.letters l
    WHERE l.author_id = p_user_id
    
    UNION
    
    -- Letters the user interacted with (replied to OR reacted to)
    SELECT 
      l.id AS letter_id, 
      l.title AS title, 
      l.content AS content, 
      l.created_at AS created_at, 
      l.author_id AS author_id, 
      'interacted' AS relationship
    FROM public.letters l
    JOIN user_interacted_letters uil ON l.id = uil.letter_id
    WHERE l.author_id != p_user_id
  ),
  letter_activities AS (
    -- Original letter creation
    SELECT 
      rl.letter_id AS letter_id,
      rl.created_at AS activity_date,
      rl.content AS activity_content,
      'letter' AS activity_type,
      rl.author_id AS actor_id
    FROM relevant_letters rl
    
    UNION ALL
    
    -- Replies to letters (only between the letter author and the current user)
    SELECT
      r.letter_id AS letter_id,
      r.created_at AS activity_date,
      r.content AS activity_content,
      'reply' AS activity_type,
      r.author_id AS actor_id
    FROM public.replies r
    JOIN relevant_letters rl ON r.letter_id = rl.letter_id
    WHERE 
      -- Only include replies from the current user
      r.author_id = p_user_id
      OR
      -- Or replies from the letter author to the current user
      (r.author_id = rl.author_id AND EXISTS (
        SELECT 1 FROM public.replies ur WHERE ur.letter_id = r.letter_id AND ur.author_id = p_user_id
      ))
    
    UNION ALL
    
    -- Reactions to letters (only between the letter author and the current user)
    SELECT
      rc.letter_id AS letter_id,
      rc.created_at AS activity_date,
      rc.reaction_type AS activity_content,
      'reaction' AS activity_type,
      rc.user_id AS actor_id
    FROM public.reactions rc
    JOIN relevant_letters rl ON rc.letter_id = rl.letter_id
    WHERE 
      -- Only include reactions from the current user
      rc.user_id = p_user_id
      OR
      -- Or reactions from the letter author to the current user's interactions
      (rc.user_id = rl.author_id AND EXISTS (
        SELECT 1 FROM public.replies ur WHERE ur.letter_id = rc.letter_id AND ur.author_id = p_user_id
      ))
  ),
  most_recent_activities AS (
    SELECT DISTINCT ON (la.letter_id)
      la.letter_id AS letter_id,
      la.activity_date AS activity_date,
      CASE
        WHEN la.activity_type = 'reaction' THEN
          CASE 
            WHEN la.actor_id = p_user_id THEN 'You reacted with ' || la.activity_content
            ELSE 'Someone reacted with ' || la.activity_content
          END
        ELSE la.activity_content
      END AS content
    FROM letter_activities la
    ORDER BY la.letter_id, la.activity_date DESC
  ),
  unread_counts AS (
    SELECT
      r.letter_id AS letter_id,
      COUNT(r.id)::BIGINT AS unread_count
    FROM public.replies r
    LEFT JOIN public.reply_reads rr ON r.id = rr.reply_id AND rr.user_id = p_user_id
    JOIN relevant_letters rl ON r.letter_id = rl.letter_id
    WHERE r.author_id != p_user_id AND rr.id IS NULL
      -- Only count unread replies from the letter author (not from other users)
      AND r.author_id = rl.author_id
    GROUP BY r.letter_id
  ),
  letter_participants AS (
    SELECT
      la.letter_id AS letter_id,
      array_agg(DISTINCT la.actor_id)::TEXT[] AS participants
    FROM letter_activities la
    GROUP BY la.letter_id
  )
  SELECT
    rl.letter_id AS letter_id,
    rl.title AS title,
    rl.content AS content,
    rl.created_at AS created_at,
    rl.author_id AS author_id,
    COALESCE(mra.activity_date, rl.created_at) AS most_recent_activity_date,
    COALESCE(mra.content, rl.content) AS most_recent_content,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(lp.participants, ARRAY[rl.author_id]::TEXT[]) AS participants,
    cat.name AS category_name,
    cat.color AS category_color
  FROM relevant_letters rl
  LEFT JOIN most_recent_activities mra ON rl.letter_id = mra.letter_id
  LEFT JOIN unread_counts uc ON rl.letter_id = uc.letter_id
  LEFT JOIN letter_participants lp ON rl.letter_id = lp.letter_id
  JOIN public.letters l ON rl.letter_id = l.id
  JOIN public.categories cat ON l.category_id = cat.id
  WHERE
    -- Include letters authored by the user that have received replies
    (rl.relationship = 'authored' AND EXISTS (
      SELECT 1 FROM public.replies r WHERE r.letter_id = rl.letter_id
    ))
    OR
    -- Include letters the user has interacted with
    rl.relationship = 'interacted'
  ORDER BY COALESCE(mra.activity_date, rl.created_at) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_correspondences(UUID) TO authenticated;
