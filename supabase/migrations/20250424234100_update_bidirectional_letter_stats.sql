-- First drop the existing function to avoid conflicts
DROP FUNCTION IF EXISTS get_my_letters_with_stats(uuid);

-- Update get_my_letters_with_stats to handle bidirectional blocking
CREATE OR REPLACE FUNCTION get_my_letters_with_stats(
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
AS $$
DECLARE
  letter_record RECORD;
  v_count BIGINT;
  r_count BIGINT;
  react_count BIGINT;
  has_unread BOOLEAN;
  param_user_id ALIAS FOR user_id;
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
      l.author_id = param_user_id
    ORDER BY
      l.created_at DESC
  LOOP
    -- Count views for this specific letter
    SELECT COUNT(*) INTO v_count
    FROM letter_reads
    WHERE letter_id = letter_record.id;
    
    -- Count replies for this specific letter, excluding blocked users (bidirectional)
    SELECT COUNT(*) INTO r_count
    FROM replies r
    WHERE r.letter_id = letter_record.id
    AND NOT EXISTS (
      -- Check if the reply author is blocked by the requesting user
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = param_user_id
      AND b.blocked_id = r.author_id
    )
    AND NOT EXISTS (
      -- Check if the reply recipient is blocked by the requesting user
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = param_user_id
      AND b.blocked_id = r.reply_to_user_id
      AND r.reply_to_user_id IS NOT NULL
    )
    -- Add bidirectional blocking checks
    AND NOT EXISTS (
      -- Check if the requesting user is blocked by the reply author
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = r.author_id
      AND b.blocked_id = param_user_id
    )
    AND NOT EXISTS (
      -- Check if the requesting user is blocked by the reply recipient
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = r.reply_to_user_id
      AND b.blocked_id = param_user_id
      AND r.reply_to_user_id IS NOT NULL
    );
    
    -- Count reactions for this specific letter, excluding blocked users (bidirectional)
    SELECT COUNT(*) INTO react_count
    FROM reactions react
    WHERE react.letter_id = letter_record.id
    AND NOT EXISTS (
      -- Check if the reaction author is blocked by the requesting user
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = param_user_id
      AND b.blocked_id = react.user_id
    )
    -- Add bidirectional blocking check
    AND NOT EXISTS (
      -- Check if the requesting user is blocked by the reaction author
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = react.user_id
      AND b.blocked_id = param_user_id
    );
    
    -- Check if there are unread reactions for this letter
    SELECT ur.has_unread_reactions INTO has_unread
    FROM get_letters_with_unread_reactions(param_user_id) ur
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
