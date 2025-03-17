CREATE OR REPLACE FUNCTION get_reply_counts(letter_ids UUID[])
RETURNS TABLE (parent_id UUID, count TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    letters.parent_id,
    COUNT(letters.id)::TEXT
  FROM 
    letters
  WHERE 
    letters.parent_id = ANY(letter_ids)
  GROUP BY 
    letters.parent_id;
END;
$$ LANGUAGE plpgsql; 