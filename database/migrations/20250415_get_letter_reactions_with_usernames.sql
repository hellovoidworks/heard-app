-- Create a function to get letter reactions with usernames
CREATE OR REPLACE FUNCTION get_letter_reactions_with_usernames(letter_id_param UUID)
RETURNS TABLE (
  reaction_type TEXT,
  created_at TIMESTAMPTZ,
  username TEXT
) 
LANGUAGE plpgsql
SECURITY INVOKER -- Using SECURITY INVOKER to respect RLS policies
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.reaction_type,
    r.created_at,
    up.username
  FROM 
    reactions r
  JOIN 
    user_profiles up ON r.user_id = up.id
  WHERE 
    r.letter_id = letter_id_param
  ORDER BY 
    r.created_at DESC;
END;
$$;
