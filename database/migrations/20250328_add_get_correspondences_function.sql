-- Migration to add a consolidated function for fetching correspondences
-- This function replaces multiple separate queries in the CorrespondenceTab component

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
DECLARE
  v_letter_id ALIAS FOR letter_id;
  v_title ALIAS FOR title;
  v_content ALIAS FOR content;
  v_created_at ALIAS FOR created_at;
  v_author_id ALIAS FOR author_id;
  v_most_recent_activity_date ALIAS FOR most_recent_activity_date;
  v_most_recent_content ALIAS FOR most_recent_content;
  v_unread_count ALIAS FOR unread_count;
  v_participants ALIAS FOR participants;
BEGIN
  RETURN QUERY
  WITH 
  -- Letters authored by the user
  authored_letters AS (
    SELECT 
      l.id,
      l.title,
      l.content,
      l.created_at,
      l.author_id
    FROM 
      public.letters l
    WHERE 
      l.author_id = p_user_id
  ),
  
  -- User's replies to find letters they've replied to
  user_replies AS (
    SELECT 
      r.letter_id,
      r.created_at
    FROM 
      public.replies r
    WHERE 
      r.author_id = p_user_id
    ORDER BY 
      r.created_at DESC
  ),
  
  -- User's reactions to find letters they've reacted to
  user_reactions AS (
    SELECT 
      rc.letter_id,
      rc.created_at
    FROM 
      public.reactions rc
    WHERE 
      rc.user_id = p_user_id
    ORDER BY 
      rc.created_at DESC
  ),
  
  -- Letters the user has interacted with (replied to or reacted to)
  interacted_letter_ids AS (
    SELECT DISTINCT ur.letter_id FROM user_replies ur
    UNION
    SELECT DISTINCT urc.letter_id FROM user_reactions urc
  ),
  
  -- Letters the user has interacted with but did not author
  interacted_letters AS (
    SELECT 
      l.id,
      l.title,
      l.content,
      l.created_at,
      l.author_id
    FROM 
      public.letters l
    WHERE 
      l.id IN (SELECT ili.letter_id FROM interacted_letter_ids ili)
      AND l.author_id != p_user_id
  ),
  
  -- All relevant letters (authored by user or interacted with)
  all_relevant_letters AS (
    SELECT * FROM authored_letters
    UNION
    SELECT * FROM interacted_letters
  ),
  
  -- All replies for each letter
  all_replies AS (
    SELECT 
      r.id,
      r.letter_id,
      r.content,
      r.author_id,
      r.created_at
    FROM 
      public.replies r
    WHERE 
      r.letter_id IN (SELECT arl.id FROM all_relevant_letters arl)
    ORDER BY 
      r.created_at DESC
  ),
  
  -- All reactions for each letter
  all_reactions AS (
    SELECT 
      rc.letter_id,
      rc.reaction_type,
      rc.user_id,
      rc.created_at
    FROM 
      public.reactions rc
    WHERE 
      rc.letter_id IN (SELECT arl.id FROM all_relevant_letters arl)
    ORDER BY 
      rc.created_at DESC
  ),
  
  -- Most recent activity (letter, reply, or reaction) for each letter
  most_recent_activity AS (
    SELECT 
      letter_id,
      MAX(activity_date) as most_recent_date
    FROM (
      -- Letter creation dates
      SELECT 
        arl.id as letter_id, 
        arl.created_at as activity_date
      FROM 
        all_relevant_letters arl
      
      UNION ALL
      
      -- Reply dates
      SELECT 
        ar.letter_id, 
        ar.created_at as activity_date
      FROM 
        all_replies ar
      
      UNION ALL
      
      -- Reaction dates
      SELECT 
        arc.letter_id, 
        arc.created_at as activity_date
      FROM 
        all_reactions arc
    ) as all_activities(letter_id, activity_date)
    GROUP BY 
      letter_id
  ),
  
  -- Most recent content (from letter, reply, or reaction)
  most_recent_content AS (
    SELECT DISTINCT ON (a.letter_id)
      a.letter_id,
      CASE
        WHEN a.source_type = 'reaction' THEN 
          CASE 
            WHEN a.user_id = p_user_id THEN 'You reacted with ' || a.content
            ELSE 'Someone reacted with ' || a.content
          END
        ELSE a.content
      END as content
    FROM (
      -- Letter content
      SELECT 
        arl.id as letter_id, 
        arl.content,
        arl.created_at as activity_date,
        'letter' as source_type,
        arl.author_id as user_id
      FROM 
        all_relevant_letters arl
      
      UNION ALL
      
      -- Reply content
      SELECT 
        ar.letter_id, 
        ar.content,
        ar.created_at as activity_date,
        'reply' as source_type,
        ar.author_id as user_id
      FROM 
        all_replies ar
      
      UNION ALL
      
      -- Reaction content
      SELECT 
        arc.letter_id, 
        arc.reaction_type as content,
        arc.created_at as activity_date,
        'reaction' as source_type,
        arc.user_id
      FROM 
        all_reactions arc
    ) a
    ORDER BY 
      a.letter_id, 
      a.activity_date DESC
  ),
  
  -- Unread counts for each letter
  unread_counts AS (
    SELECT 
      r.letter_id, 
      COUNT(r.id)::BIGINT as unread_count
    FROM 
      public.replies r
    LEFT JOIN 
      public.reply_reads rr ON r.id = rr.reply_id AND rr.user_id = p_user_id
    WHERE 
      r.letter_id IN (SELECT arl.id FROM all_relevant_letters arl)
      AND r.author_id != p_user_id
      AND rr.id IS NULL
    GROUP BY 
      r.letter_id
  ),
  
  -- Participants for each letter
  participants AS (
    SELECT 
      letter_id,
      array_agg(DISTINCT participant_id)::TEXT[] as participants
    FROM (
      -- Letter authors
      SELECT 
        arl.id as letter_id, 
        arl.author_id as participant_id
      FROM 
        all_relevant_letters arl
      
      UNION
      
      -- Reply authors
      SELECT 
        ar.letter_id, 
        ar.author_id as participant_id
      FROM 
        all_replies ar
    ) as all_participants(letter_id, participant_id)
    GROUP BY 
      letter_id
  )
  
  -- Final result combining all the data
  SELECT 
    l.id as letter_id,
    l.title,
    l.content,
    l.created_at,
    l.author_id,
    mra.most_recent_date as most_recent_activity_date,
    mrc.content as most_recent_content,
    COALESCE(uc.unread_count, 0) as unread_count,
    COALESCE(p.participants, ARRAY[]::TEXT[]) as participants
  FROM 
    all_relevant_letters l
  LEFT JOIN 
    most_recent_activity mra ON l.id = mra.letter_id
  LEFT JOIN 
    most_recent_content mrc ON l.id = mrc.letter_id
  LEFT JOIN 
    unread_counts uc ON l.id = uc.letter_id
  LEFT JOIN 
    participants p ON l.id = p.letter_id
  WHERE 
    -- Include letters authored by the user that have received replies
    (l.author_id = p_user_id AND EXISTS (
      SELECT 1 FROM all_replies r WHERE r.letter_id = l.id
    ))
    OR 
    -- Include letters authored by others that the user has replied to or reacted to
    (l.author_id != p_user_id AND (
      EXISTS (SELECT 1 FROM all_replies r WHERE r.letter_id = l.id) OR
      EXISTS (SELECT 1 FROM user_reactions ur WHERE ur.letter_id = l.id)
    ))
  ORDER BY 
    mra.most_recent_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_correspondences(UUID) TO authenticated;
