-- Migration to add a consolidated function for fetching correspondences
-- This function replaces multiple separate queries in the CorrespondenceTab component
-- Fixed version to avoid ambiguous column references

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
  participants TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH user_authored_letters AS (
    SELECT l.id
    FROM public.letters l
    WHERE l.author_id = p_user_id
  ),
  user_replied_letters AS (
    SELECT DISTINCT r.letter_id
    FROM public.replies r
    WHERE r.author_id = p_user_id
  ),
  user_reacted_letters AS (
    SELECT DISTINCT rc.letter_id
    FROM public.reactions rc
    WHERE rc.user_id = p_user_id
  ),
  relevant_letters AS (
    -- Letters authored by the user
    SELECT l.id, l.title, l.content, l.created_at, l.author_id, 'authored' AS relationship
    FROM public.letters l
    WHERE l.author_id = p_user_id
    
    UNION
    
    -- Letters the user replied to
    SELECT l.id, l.title, l.content, l.created_at, l.author_id, 'replied' AS relationship
    FROM public.letters l
    JOIN user_replied_letters url ON l.id = url.letter_id
    WHERE l.author_id != p_user_id
    
    UNION
    
    -- Letters the user reacted to
    SELECT l.id, l.title, l.content, l.created_at, l.author_id, 'reacted' AS relationship
    FROM public.letters l
    JOIN user_reacted_letters url ON l.id = url.letter_id
    WHERE l.author_id != p_user_id
  ),
  letter_activities AS (
    -- Original letter creation
    SELECT 
      rl.id AS letter_id,
      rl.created_at AS activity_date,
      rl.content AS activity_content,
      'letter' AS activity_type,
      rl.author_id AS actor_id
    FROM relevant_letters rl
    
    UNION ALL
    
    -- Replies to letters
    SELECT
      r.letter_id,
      r.created_at AS activity_date,
      r.content AS activity_content,
      'reply' AS activity_type,
      r.author_id AS actor_id
    FROM public.replies r
    JOIN relevant_letters rl ON r.letter_id = rl.id
    
    UNION ALL
    
    -- Reactions to letters
    SELECT
      rc.letter_id,
      rc.created_at AS activity_date,
      rc.reaction_type AS activity_content,
      'reaction' AS activity_type,
      rc.user_id AS actor_id
    FROM public.reactions rc
    JOIN relevant_letters rl ON rc.letter_id = rl.id
  ),
  most_recent_activities AS (
    SELECT DISTINCT ON (la.letter_id)
      la.letter_id,
      la.activity_date,
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
      r.letter_id,
      COUNT(r.id)::BIGINT AS unread_count
    FROM public.replies r
    LEFT JOIN public.reply_reads rr ON r.id = rr.reply_id AND rr.user_id = p_user_id
    JOIN relevant_letters rl ON r.letter_id = rl.id
    WHERE r.author_id != p_user_id AND rr.id IS NULL
    GROUP BY r.letter_id
  ),
  letter_participants AS (
    SELECT
      la.letter_id,
      array_agg(DISTINCT la.actor_id)::TEXT[] AS participants
    FROM letter_activities la
    GROUP BY la.letter_id
  )
  SELECT
    rl.id AS letter_id,
    rl.title,
    rl.content,
    rl.created_at,
    rl.author_id,
    COALESCE(mra.activity_date, rl.created_at) AS most_recent_activity_date,
    COALESCE(mra.content, rl.content) AS most_recent_content,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(lp.participants, ARRAY[rl.author_id]::TEXT[]) AS participants
  FROM relevant_letters rl
  LEFT JOIN most_recent_activities mra ON rl.id = mra.letter_id
  LEFT JOIN unread_counts uc ON rl.id = uc.letter_id
  LEFT JOIN letter_participants lp ON rl.id = lp.letter_id
  WHERE
    -- Include letters authored by the user that have received replies
    (rl.relationship = 'authored' AND EXISTS (
      SELECT 1 FROM public.replies r WHERE r.letter_id = rl.id
    ))
    OR
    -- Include letters the user has replied to or reacted to
    rl.relationship IN ('replied', 'reacted')
  ORDER BY COALESCE(mra.activity_date, rl.created_at) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_correspondences(UUID) TO authenticated;
