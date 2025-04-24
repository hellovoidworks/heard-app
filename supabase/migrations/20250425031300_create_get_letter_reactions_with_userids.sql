-- Create a new function that includes user_id in the return values
CREATE OR REPLACE FUNCTION get_letter_reactions_with_userids(letter_id_param UUID)
RETURNS TABLE (
  reaction_type TEXT,
  created_at TIMESTAMPTZ,
  username TEXT,
  user_id UUID  -- Including user_id in the return values
) 
LANGUAGE plpgsql
SECURITY INVOKER -- Using SECURITY INVOKER to respect RLS policies
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.reaction_type,
    r.created_at,
    up.username,
    r.user_id    -- Including user_id in the returned data
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
