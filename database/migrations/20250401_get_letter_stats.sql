-- Migration to create a function that returns letter statistics (views, replies, reactions)
-- This function will be used by the MyLettersTab to get statistics for each letter

-- Create the function
CREATE OR REPLACE FUNCTION get_letter_stats(user_id UUID)
RETURNS TABLE (
  letter_id UUID,
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
  -- Join all the counts together
  SELECT
    ul.id AS letter_id,
    COALESCE(vc.count, 0) AS view_count,
    COALESCE(rc.count, 0) AS reply_count,
    COALESCE(reac.count, 0) AS reaction_count
  FROM
    user_letters ul
  LEFT JOIN
    view_counts vc ON ul.id = vc.letter_id
  LEFT JOIN
    reply_counts rc ON ul.id = rc.letter_id
  LEFT JOIN
    reaction_counts reac ON ul.id = reac.letter_id;
END;
$$ LANGUAGE plpgsql;
