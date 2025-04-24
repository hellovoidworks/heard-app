DROP FUNCTION get_unread_letters_not_by_user(uuid, integer);

-- Update get_unread_letters_not_by_user function to exclude letters from blocked users
CREATE OR REPLACE FUNCTION get_unread_letters_not_by_user(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  author_id UUID,
  category_id UUID,
  mood_emoji TEXT,
  category_name TEXT,
  category_color TEXT,
  display_name TEXT,
  author JSONB,
  is_read BOOLEAN,
  display_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_order INTEGER := 1000;
BEGIN
  -- Get user's received letters
  CREATE TEMP TABLE temp_received_letters ON COMMIT DROP AS
  SELECT lrec.letter_id
  FROM public.letter_received lrec
  WHERE lrec.user_id = p_user_id;

  -- Get user's preferred categories
  CREATE TEMP TABLE temp_preferred_categories ON COMMIT DROP AS
  SELECT ucp.category_id
  FROM public.user_category_preferences ucp
  WHERE ucp.user_id = p_user_id;

  -- Result table
  CREATE TEMP TABLE temp_result_letters (
    id uuid,
    title text,
    content text,
    created_at timestamp with time zone,
    author_id uuid,
    category_id uuid,
    mood_emoji text,
    category_name text,
    category_color text,
    display_name text,
    author jsonb,
    is_read boolean,
    display_order integer
  ) ON COMMIT DROP;

  -- First try to get unread letters from preferred categories that haven't been received
  -- Using RANDOM() for ordering
  INSERT INTO temp_result_letters
  WITH preferred_new_letters AS (
    SELECT
      l.id,
      l.title,
      l.content,
      l.created_at,
      l.author_id,
      l.category_id,
      l.mood_emoji,
      c.name AS category_name,
      c.color AS category_color,
      l.display_name,
      jsonb_build_object(
        'id', up.id,
        'username', up.username,
        'avatar_url', up.avatar_url,
        'notification_preferences', up.notification_preferences,
        'created_at', up.created_at,
        'updated_at', up.updated_at,
        'birthdate', up.birthdate,
        'onboarding_step', up.onboarding_step,
        'onboarding_completed', up.onboarding_completed,
        'stars', up.stars
      ) AS author,
      FALSE AS is_read, -- Always false for newly received letters
      (base_order + ROW_NUMBER() OVER (ORDER BY RANDOM()))::INTEGER AS display_order
    FROM public.letters l
    JOIN public.categories c ON l.category_id = c.id
    JOIN public.user_profiles up ON l.author_id = up.id
    JOIN temp_preferred_categories pc ON l.category_id = pc.category_id
    WHERE
      l.author_id != p_user_id
      AND NOT EXISTS (SELECT 1 FROM temp_received_letters rcv WHERE rcv.letter_id = l.id)
      -- NEW: Filter out letters from blocked users
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks b
        WHERE (b.blocker_id = p_user_id AND b.blocked_id = l.author_id) -- User blocked the author
          OR (b.blocker_id = l.author_id AND b.blocked_id = p_user_id) -- Author blocked the user
      )
    ORDER BY RANDOM()
    LIMIT p_limit
  )
  SELECT * FROM preferred_new_letters;

  -- If we haven't reached the limit, try getting letters from any category
  IF (SELECT COUNT(*) FROM temp_result_letters) < p_limit THEN
    INSERT INTO temp_result_letters
    WITH any_category_letters AS (
      SELECT
        l.id,
        l.title,
        l.content,
        l.created_at,
        l.author_id,
        l.category_id,
        l.mood_emoji,
        c.name AS category_name,
        c.color AS category_color,
        l.display_name,
        jsonb_build_object(
        'id', up.id,
        'username', up.username,
        'avatar_url', up.avatar_url,
        'notification_preferences', up.notification_preferences,
        'created_at', up.created_at,
        'updated_at', up.updated_at,
        'birthdate', up.birthdate,
        'onboarding_step', up.onboarding_step,
        'onboarding_completed', up.onboarding_completed,
        'stars', up.stars
      ) AS author,
        FALSE AS is_read, -- Always false for newly received letters
        (base_order + 1000 + ROW_NUMBER() OVER (ORDER BY RANDOM()))::INTEGER AS display_order
      FROM public.letters l
      JOIN public.categories c ON l.category_id = c.id
      JOIN public.user_profiles up ON l.author_id = up.id
      WHERE
        l.author_id != p_user_id
        AND NOT EXISTS (SELECT 1 FROM temp_received_letters rcv WHERE rcv.letter_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM temp_result_letters trl WHERE trl.id = l.id) -- Avoid duplicates from preferred batch
        -- NEW: Filter out letters from blocked users
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = p_user_id AND b.blocked_id = l.author_id) -- User blocked the author
            OR (b.blocker_id = l.author_id AND b.blocked_id = p_user_id) -- Author blocked the user
        )
      ORDER BY RANDOM()
      LIMIT (p_limit - (SELECT COUNT(*) FROM temp_result_letters))
    )
    SELECT * FROM any_category_letters;
  END IF;

  -- Record these letters as received by the user
  INSERT INTO public.letter_received (user_id, letter_id, received_at, display_order)
  SELECT
    p_user_id AS user_id,
    trl.id AS letter_id,
    NOW() AS received_at,
    trl.display_order
  FROM temp_result_letters trl
  ON CONFLICT (user_id, letter_id)
  DO UPDATE SET display_order = EXCLUDED.display_order, received_at = NOW(); -- Update received_at as well

  -- Return the result set
  RETURN QUERY
  SELECT * FROM temp_result_letters trl
  ORDER BY trl.display_order DESC; -- Non-preferred appear first
END;
$$;
