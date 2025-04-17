-- Update get_my_letters_with_stats function to include display_name field
-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_my_letters_with_stats(uuid);

-- Create the updated function with display_name in return type and query
CREATE OR REPLACE FUNCTION public.get_my_letters_with_stats(user_id uuid)
RETURNS TABLE(
  id uuid, 
  title text, 
  content text, 
  created_at timestamp with time zone, 
  category_id uuid, 
  category_name text, 
  category_color text, 
  mood_emoji text, 
  view_count bigint, 
  reply_count bigint, 
  reaction_count bigint,
  display_name text
)
LANGUAGE plpgsql
AS $function$
DECLARE
  letter_record RECORD;
  v_count BIGINT;
  r_count BIGINT;
  react_count BIGINT;
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
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$function$;

COMMENT ON FUNCTION public.get_my_letters_with_stats(uuid) IS 
'Returns all letters authored by the specified user, including view count, reply count, and reaction count statistics. Now includes display_name field.';
