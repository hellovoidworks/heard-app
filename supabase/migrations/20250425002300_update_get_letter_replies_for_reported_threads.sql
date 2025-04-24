-- Migration: update_get_letter_replies_for_reported_threads.sql

-- UP MIGRATION
BEGIN;

-- Create or replace the function to also filter out reported threads
CREATE OR REPLACE FUNCTION public.get_letter_replies_excluding_blocked_and_reported(
  p_letter_id UUID,
  p_user_id UUID
)
RETURNS SETOF replies
LANGUAGE plpgsql
SECURITY INVOKER
AS $function$
DECLARE
  v_blocked_user_ids UUID[];
BEGIN
  -- Get the list of user IDs that the current user has blocked
  SELECT array_agg(blocked_user_id)
  INTO v_blocked_user_ids
  FROM user_blocks
  WHERE user_id = p_user_id;
  
  -- Return all replies for this letter, excluding those from blocked users and reported threads
  RETURN QUERY
  SELECT r.*
  FROM replies r
  WHERE 
    r.letter_id = p_letter_id
    AND (
      v_blocked_user_ids IS NULL  -- No blocked users
      OR r.author_id != ALL(v_blocked_user_ids)  -- Author not in blocked list
    )
    AND NOT EXISTS (  -- Exclude reported threads
      SELECT 1
      FROM content_reports cr
      WHERE 
        cr.reporter_id = p_user_id 
        AND cr.letter_id = p_letter_id
        AND cr.content_type = 'reply'
        AND cr.other_participant_id = r.author_id
    )
  ORDER BY r.created_at ASC;  -- Oldest first to maintain chronological order
END;
$function$;

COMMENT ON FUNCTION public.get_letter_replies_excluding_blocked_and_reported IS 'Get all replies for a letter, excluding blocked users and reported threads';

COMMIT;

-- DOWN MIGRATION
BEGIN;

-- In case we need to roll back, just drop the new function
DROP FUNCTION IF EXISTS public.get_letter_replies_excluding_blocked_and_reported(UUID, UUID);

COMMIT;
