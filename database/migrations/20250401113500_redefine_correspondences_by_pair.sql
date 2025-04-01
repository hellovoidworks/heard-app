-- Migration to redefine correspondences based on user pairs (letter author <-> replier)

CREATE OR REPLACE FUNCTION get_user_correspondences_by_pair(p_user_id UUID)
RETURNS TABLE (
  -- Identifying Keys for the unique conversation pair
  letter_id UUID,
  other_participant_id UUID,

  -- Original Letter Details (for context)
  letter_title TEXT,
  letter_author_id UUID,
  letter_created_at TIMESTAMPTZ,

  -- Details about the interaction between p_user_id and other_participant_id for this letter
  most_recent_interaction_at TIMESTAMPTZ,
  most_recent_interaction_content TEXT,
  most_recent_interactor_id UUID, -- Who made the most recent interaction in this pair?
  unread_message_count BIGINT -- Count of unread messages from other_participant_id to p_user_id
) AS $$
BEGIN
  RETURN QUERY
  WITH letter_interactions AS (
    -- Gather all letters and their direct replies
    SELECT
      l.id as letter_id,
      l.title as letter_title,
      l.author_id as letter_author_id,
      l.created_at as letter_created_at,
      r.id as reply_id,
      r.author_id as replier_id,
      r.content as reply_content,
      r.created_at as reply_created_at
    FROM public.letters l
    LEFT JOIN public.replies r ON l.id = r.letter_id
  ),
  relevant_pairs AS (
    -- Identify unique conversation pairs involving p_user_id
    -- Pair 1: p_user_id is the letter author, other is a replier
    SELECT DISTINCT
      li.letter_id,
      li.replier_id as other_participant_id,
      li.letter_title,
      li.letter_author_id,
      li.letter_created_at
    FROM letter_interactions li
    WHERE li.letter_author_id = p_user_id
      AND li.replier_id IS NOT NULL -- Ensure there was a reply
      AND li.replier_id != p_user_id -- Don't pair with self-replies initially (handled implicitly later if needed)

    UNION

    -- Pair 2: p_user_id is a replier, other is the letter author
    SELECT DISTINCT
      li.letter_id,
      li.letter_author_id as other_participant_id,
      li.letter_title,
      li.letter_author_id,
      li.letter_created_at
    FROM letter_interactions li
    WHERE li.replier_id = p_user_id
      AND li.letter_author_id != p_user_id -- Not replying to own letter initially
  ),
  pair_interactions AS (
    -- Get all interactions (original letter post + replies) specifically between the pair for each letter
    SELECT
      rp.letter_id,
      rp.other_participant_id,
      rp.letter_title,
      rp.letter_author_id,
      rp.letter_created_at,
      -- Include the original letter post as an interaction
      rp.letter_author_id as interactor_id,
      rp.letter_created_at as interaction_at,
      '(Original Letter)' as interaction_content -- Placeholder for original
    FROM relevant_pairs rp

    UNION ALL

    SELECT
      rp.letter_id,
      rp.other_participant_id,
      rp.letter_title,
      rp.letter_author_id,
      rp.letter_created_at,
      -- Include replies between the pair
      r.author_id as interactor_id,
      r.created_at as interaction_at,
      r.content as interaction_content
    FROM relevant_pairs rp
    JOIN public.replies r ON rp.letter_id = r.letter_id
    WHERE (r.author_id = p_user_id AND rp.other_participant_id = rp.letter_author_id) -- User replied to author
       OR (r.author_id = rp.other_participant_id AND rp.other_participant_id = r.author_id) -- Other replied to user (when user is author)
  ),
  ranked_pair_interactions AS (
    -- Rank interactions within each pair to find the most recent
    SELECT
      pi.*,
      ROW_NUMBER() OVER (PARTITION BY pi.letter_id, pi.other_participant_id ORDER BY pi.interaction_at DESC) as rn
    FROM pair_interactions pi
  ),
  most_recent_pair_interaction AS (
    SELECT *
    FROM ranked_pair_interactions
    WHERE rn = 1
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
    WHERE r.author_id = rp.other_participant_id -- Message is from the other participant
      AND rr.read_at IS NULL -- And it hasn't been read by p_user_id
    GROUP BY rp.letter_id, rp.other_participant_id
  )
  -- Final assembly
  SELECT
    mri.letter_id,
    mri.other_participant_id,
    mri.letter_title,
    mri.letter_author_id,
    mri.letter_created_at,
    mri.interaction_at as most_recent_interaction_at,
    mri.interaction_content as most_recent_interaction_content,
    mri.interactor_id as most_recent_interactor_id,
    COALESCE(upm.unread_count, 0) as unread_message_count
  FROM most_recent_pair_interaction mri
  LEFT JOIN unread_pair_messages upm ON mri.letter_id = upm.letter_id AND mri.other_participant_id = upm.other_participant_id
  ORDER BY most_recent_interaction_at DESC;

END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_correspondences_by_pair(UUID) TO authenticated;

-- Optionally: Drop the old function if it's being fully replaced
-- DROP FUNCTION IF EXISTS get_user_correspondences(UUID);
