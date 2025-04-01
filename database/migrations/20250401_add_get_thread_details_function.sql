-- Function to get letter details and replies between two specific users for that letter
CREATE OR REPLACE FUNCTION public.get_thread_details(
    p_letter_id uuid,
    p_user_id uuid, 
    p_other_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER -- Important: Run with the permissions of the calling user to enforce RLS
AS $$
DECLARE
    letter_details jsonb;
    replies_array jsonb;
BEGIN
    -- Fetch letter details (ensure user has access via RLS on letters table)
    SELECT jsonb_build_object(
        'id', l.id,
        'author_id', l.author_id,
        'display_name', l.display_name,
        'title', l.title,
        'content', l.content,
        'category_id', l.category_id,
        'created_at', l.created_at,
        'updated_at', l.updated_at,
        'is_anonymous', l.is_anonymous,
        'mood_emoji', l.mood_emoji,
        'category', jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'color', c.color,
            'description', c.description
        ),
        'author', jsonb_build_object(
            'id', up.id,
            'stars', up.stars,
            'username', up.username,
            'avatar_url', up.avatar_url
            -- Add other necessary author fields, but avoid sensitive ones like birthdate
        )
    )
    INTO letter_details
    FROM public.letters l
    LEFT JOIN public.categories c ON l.category_id = c.id
    LEFT JOIN public.user_profiles up ON l.author_id = up.id
    WHERE l.id = p_letter_id;

    -- Fetch replies exchanged between the two participants for this letter
    -- RLS on replies table will be checked due to SECURITY INVOKER
    SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at ASC), '[]'::jsonb)
    INTO replies_array
    FROM (
        SELECT 
            rep.id,
            rep.letter_id,
            rep.author_id,
            rep.reply_to_user_id,
            rep.display_name,
            rep.content,
            rep.created_at
            -- Add other necessary reply fields
        FROM public.replies rep
        WHERE rep.letter_id = p_letter_id
          AND (
              (rep.author_id = p_user_id AND rep.reply_to_user_id = p_other_participant_id) OR
              (rep.author_id = p_other_participant_id AND rep.reply_to_user_id = p_user_id)
          )
    ) r;

    -- Return the combined result
    RETURN jsonb_build_object(
        'letter', letter_details,
        'replies', replies_array
    );
END;
$$;

COMMENT ON FUNCTION public.get_thread_details(uuid, uuid, uuid) IS 'Fetches details for a specific letter and only the replies exchanged between the specified user and the other participant for that letter.';
