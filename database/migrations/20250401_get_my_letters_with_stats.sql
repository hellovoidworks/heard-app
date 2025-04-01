-- Migration to create a function that returns all letters authored by a user along with their statistics
-- This function will be used by the MyLettersTab to get letters and their stats in a single query

-- Create the function
CREATE OR REPLACE FUNCTION get_my_letters_with_stats(user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  mood_emoji TEXT,
  view_count BIGINT,
  reply_count BIGINT,
  reaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_letters AS (
    -- Get all letters authored by the user
    SELECT id FROM letters WHERE author_id = user_id
  ),
  view_counts AS (
    -- Count views for each letter
    SELECT 
      letter_id,
      COUNT(*) AS count
    FROM 
      letter_reads
    WHERE 
      letter_id IN (SELECT id FROM user_letters)
    GROUP BY 
      letter_id
  ),
  reply_counts AS (
    -- Count replies for each letter
    SELECT 
      letter_id,
      COUNT(*) AS count
    FROM 
      replies
    WHERE 
      letter_id IN (SELECT id FROM user_letters)
    GROUP BY 
      letter_id
  ),
  reaction_counts AS (
    -- Count reactions for each letter
    SELECT 
      letter_id,
      COUNT(*) AS count
    FROM 
      reactions
    WHERE 
      letter_id IN (SELECT id FROM user_letters)
    GROUP BY 
      letter_id
  )
  -- Get all letters with their stats
  SELECT
    l.id,
    l.title,
    l.content,
    l.created_at,
    c.id AS category_id,
    c.name AS category_name,
    c.color AS category_color,
    l.mood_emoji,
    COALESCE(vc.count, 0) AS view_count,
    COALESCE(rc.count, 0) AS reply_count,
    COALESCE(reac.count, 0) AS reaction_count
  FROM
    letters l
  LEFT JOIN
    categories c ON l.category_id = c.id
  LEFT JOIN
    view_counts vc ON l.id = vc.letter_id
  LEFT JOIN
    reply_counts rc ON l.id = rc.letter_id
  LEFT JOIN
    reaction_counts reac ON l.id = reac.letter_id
  WHERE
    l.id IN (SELECT id FROM user_letters)
  ORDER BY
    l.created_at DESC;
END;
$$ LANGUAGE plpgsql;
