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
BEGIN
  -- Return all replies for this letter, excluding those from blocked users and reported threads
  RETURN QUERY
  SELECT r.*
  FROM replies r
  WHERE r.letter_id = p_letter_id
  -- Preserve all existing blocking checks
  AND NOT EXISTS (
    -- Check if the reply author is blocked by the requesting user
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = p_user_id
    AND b.blocked_id = r.author_id
  )
  AND NOT EXISTS (
    -- Check if the reply recipient is blocked by the requesting user
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = p_user_id
    AND b.blocked_id = r.reply_to_user_id
    AND r.reply_to_user_id IS NOT NULL
  )
  AND NOT EXISTS (
    -- Check if the requesting user is blocked by the reply author
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = r.author_id
    AND b.blocked_id = p_user_id
  )
  AND NOT EXISTS (
    -- Check if the requesting user is blocked by the reply recipient
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_id = r.reply_to_user_id
    AND b.blocked_id = p_user_id
    AND r.reply_to_user_id IS NOT NULL
  )
  -- Add new filter for reported threads
  AND NOT EXISTS (
    -- Check if the requesting user has reported this conversation
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
