\
-- Recreate the function get_user_correspondences_by_pair with refined interaction filtering
CREATE OR REPLACE FUNCTION public.get_user_correspondences_by_pair(p_user_id uuid)
RETURNS TABLE(
    letter_id uuid, 
    other_participant_id uuid, 
    letter_title text, 
    letter_author_id uuid, 
    letter_created_at timestamp with time zone, 
    category_name text, 
    category_color text, 
    mood_emoji text, 
    most_recent_interaction_at timestamp with time zone, 
    most_recent_interaction_content text, 
    most_recent_interactor_id uuid, 
    unread_message_count bigint
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH letter_details AS (
    -- Get basic letter details including author and category
    SELECT
      l.id as letter_id,
      l.title as letter_title,
      l.author_id as letter_author_id,
      l.created_at as letter_created_at,
      c.name as category_name, 
      c.color as category_color, 
      l.mood_emoji
    FROM public.letters l
    LEFT JOIN public.categories c ON l.category_id = c.id 
  ),
  user_replies AS (
      -- Replies sent or received by the user
      SELECT 
          r.letter_id, 
          r.author_id, 
          r.reply_to_user_id
      FROM public.replies r
      WHERE r.author_id = p_user_id OR r.reply_to_user_id = p_user_id
  ),
  user_reactions AS (
      -- Letters reacted to by the user (where user is not the author)
      SELECT 
          rc.letter_id,
          ld.letter_author_id 
      FROM public.reactions rc
      JOIN letter_details ld ON rc.letter_id = ld.letter_id
      WHERE rc.user_id = p_user_id 
        AND ld.letter_author_id != p_user_id
  ),
  relevant_pairs AS (
    -- Identify unique conversation pairs involving p_user_id
    -- Uses UNION to naturally deduplicate pairs
    SELECT DISTINCT -- Ensure pairs are unique
      ld.letter_id,
      ur.author_id as other_participant_id -- User received reply from this person
    FROM letter_details ld
    JOIN user_replies ur ON ld.letter_id = ur.letter_id
    WHERE ld.letter_author_id = p_user_id -- User wrote the letter
      AND ur.reply_to_user_id = p_user_id -- And received a reply

    UNION

    SELECT DISTINCT
      ld.letter_id,
      ld.letter_author_id as other_participant_id -- User replied to the author
    FROM letter_details ld
    JOIN user_replies ur ON ld.letter_id = ur.letter_id
    WHERE ur.author_id = p_user_id -- User wrote a reply
      AND ld.letter_author_id != p_user_id -- To someone else's letter

    UNION

    SELECT DISTINCT
      ld.letter_id,
      ld.letter_author_id as other_participant_id -- User reacted to the author's letter
    FROM letter_details ld
    JOIN user_reactions ureact ON ld.letter_id = ureact.letter_id
    WHERE ld.letter_author_id != p_user_id -- Ensure it's not the user's own letter
  ),
  pair_interactions AS (
    -- Gather interactions strictly BETWEEN the identified pair members for each letter
    -- Replies BETWEEN the pair
    SELECT
      rp.letter_id,
      rp.other_participant_id,
      r.author_id as interactor_id,
      r.created_at as interaction_at,
      r.content as interaction_content
    FROM relevant_pairs rp
    JOIN public.replies r ON rp.letter_id = r.letter_id
    WHERE (r.author_id = p_user_id AND r.reply_to_user_id = rp.other_participant_id) -- P -> O
       OR (r.author_id = rp.other_participant_id AND r.reply_to_user_id = p_user_id) -- O -> P

    UNION ALL -- Use UNION ALL as reaction/reply sources are distinct interaction types

    -- Reactions BY p_user_id ON the letter (only relevant if p_user_id is not the author)
    SELECT
      rp.letter_id,
      rp.other_participant_id,
      p_user_id as interactor_id,
      rc.created_at as interaction_at,
      'Reacted with ' || rc.reaction_type as interaction_content
    FROM relevant_pairs rp
    JOIN public.reactions rc ON rp.letter_id = rc.letter_id
    JOIN letter_details ld ON rp.letter_id = ld.letter_id
    WHERE rc.user_id = p_user_id
      AND ld.letter_author_id = rp.other_participant_id -- Make sure user reacted to the OTHER person's letter
  ),
  ranked_pair_interactions AS (
    -- Rank interactions within each pair to find the most recent
    SELECT
      pi.*,
      ROW_NUMBER() OVER (PARTITION BY pi.letter_id, pi.other_participant_id ORDER BY pi.interaction_at DESC) as rn
    FROM pair_interactions pi
  ),
  most_recent_pair_interaction AS (
    SELECT rpi.*, ld.letter_title, ld.letter_author_id, ld.letter_created_at, ld.category_name, ld.category_color, ld.mood_emoji
    FROM ranked_pair_interactions rpi
    JOIN letter_details ld ON rpi.letter_id = ld.letter_id
    WHERE rpi.rn = 1
  ),
  unread_pair_messages AS (
    -- Count unread messages FROM the other participant TO p_user_id for each pair
    SELECT
      rp.letter_id,
      rp.other_participant_id,
      COUNT(r.id)::BIGINT as unread_count
    FROM relevant_pairs rp
    JOIN public.replies r ON rp.letter_id = r.letter_id
    LEFT JOIN public.reply_reads rr ON r.id = rr.reply_id AND rr.user_id = p_user_id
    WHERE r.author_id = rp.other_participant_id -- Reply is FROM the other participant
      AND r.reply_to_user_id = p_user_id      -- Reply is TO the current user
      AND rr.read_at IS NULL                  -- And it hasn't been read
    GROUP BY rp.letter_id, rp.other_participant_id
  )
  -- Final assembly
  SELECT
    mri.letter_id,
    mri.other_participant_id,
    mri.letter_title,
    mri.letter_author_id,
    mri.letter_created_at,
    mri.category_name, 
    mri.category_color, 
    mri.mood_emoji,
    mri.interaction_at as most_recent_interaction_at,
    mri.interaction_content as most_recent_interaction_content,
    mri.interactor_id as most_recent_interactor_id,
    COALESCE(upm.unread_count, 0) as unread_message_count
  FROM most_recent_pair_interaction mri
  LEFT JOIN unread_pair_messages upm ON mri.letter_id = upm.letter_id AND mri.other_participant_id = upm.other_participant_id
  ORDER BY most_recent_interaction_at DESC;

END;
$function$;

COMMENT ON FUNCTION public.get_user_correspondences_by_pair(uuid) IS 
'Fetches pairs of users who have interacted via letters, replies, or reactions, relative to the input user ID. 
Shows the latest interaction strictly *between* the pair for each letter thread. 
Includes a count of unread replies from the other participant to the input user for each pair.';
