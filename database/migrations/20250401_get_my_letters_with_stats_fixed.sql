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
    -- Count views for each letter
    COALESCE((
      SELECT COUNT(*)
      FROM letter_reads lr
      WHERE lr.letter_id = l.id
    ), 0) AS view_count,
    -- Count replies for each letter
    COALESCE((
      SELECT COUNT(*)
      FROM replies r
      WHERE r.letter_id = l.id
    ), 0) AS reply_count,
    -- Count reactions for each letter
    COALESCE((
      SELECT COUNT(*)
      FROM reactions re
      WHERE re.letter_id = l.id
    ), 0) AS reaction_count
  FROM
    letters l
  LEFT JOIN
    categories c ON l.category_id = c.id
  WHERE
    l.author_id = user_id
  ORDER BY
    l.created_at DESC;
END;
$$ LANGUAGE plpgsql;
