-- Create a function to get letters with unread reactions
CREATE OR REPLACE FUNCTION public.get_letters_with_unread_reactions(
  user_id_param UUID
)
RETURNS TABLE (
  letter_id UUID,
  has_unread_reactions BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH latest_reactions AS (
    -- Get the latest reaction timestamp for each letter
    SELECT 
      r.letter_id,
      MAX(r.created_at) AS latest_reaction_time
    FROM 
      public.reactions r
    JOIN 
      public.letters l ON r.letter_id = l.id
    WHERE 
      l.author_id = user_id_param
    GROUP BY 
      r.letter_id
  ),
  latest_views AS (
    -- Get the latest time the user viewed reactions for each letter
    SELECT 
      rr.letter_id,
      rr.last_viewed_at
    FROM 
      public.reaction_reads rr
    WHERE 
      rr.user_id = user_id_param
  )
  SELECT 
    lr.letter_id,
    CASE
      -- If there's no view record or the latest reaction is newer than the latest view
      WHEN lv.last_viewed_at IS NULL OR lr.latest_reaction_time > lv.last_viewed_at
      THEN TRUE
      ELSE FALSE
    END AS has_unread_reactions
  FROM 
    latest_reactions lr
  LEFT JOIN 
    latest_views lv ON lr.letter_id = lv.letter_id;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_letters_with_unread_reactions TO authenticated;

-- Drop the existing function first to avoid return type errors
DROP FUNCTION IF EXISTS public.get_my_letters_with_stats(UUID);

-- Add has_unread_reactions field to get_my_letters_with_stats function
CREATE FUNCTION public.get_my_letters_with_stats(
  user_id UUID
)
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
  reaction_count BIGINT,
  display_name TEXT,
  has_unread_reactions BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  letter_record RECORD;
  v_count BIGINT;
  r_count BIGINT;
  react_count BIGINT;
  has_unread BOOLEAN;
BEGIN
  -- For each letter authored by the user
  FOR letter_record IN 
    SELECT 
      l.id,
      l.title,
      l.content,
      l.created_at,
      c.id AS category_id,
      c.name AS category_name,
      c.color AS category_color,
      l.mood_emoji,
      l.display_name
    FROM 
      letters l
    LEFT JOIN
      categories c ON l.category_id = c.id
    WHERE 
      l.author_id = user_id
    ORDER BY
      l.created_at DESC
  LOOP
    -- Count views for this specific letter
    SELECT COUNT(*) INTO v_count
    FROM letter_reads
    WHERE letter_id = letter_record.id;
    
    -- Count replies for this specific letter
    SELECT COUNT(*) INTO r_count
    FROM replies
    WHERE letter_id = letter_record.id;
    
    -- Count reactions for this specific letter
    SELECT COUNT(*) INTO react_count
    FROM reactions
    WHERE letter_id = letter_record.id;
    
    -- Check if there are unread reactions for this letter
    SELECT ur.has_unread_reactions INTO has_unread
    FROM get_letters_with_unread_reactions(user_id) ur
    WHERE ur.letter_id = letter_record.id;
    
    -- Return the letter with its statistics
    id := letter_record.id;
    title := letter_record.title;
    content := letter_record.content;
    created_at := letter_record.created_at;
    category_id := letter_record.category_id;
    category_name := letter_record.category_name;
    category_color := letter_record.category_color;
    mood_emoji := letter_record.mood_emoji;
    view_count := v_count;
    reply_count := r_count;
    reaction_count := react_count;
    display_name := letter_record.display_name;
    has_unread_reactions := COALESCE(has_unread, FALSE);
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute permission on the updated function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_letters_with_stats TO authenticated;
