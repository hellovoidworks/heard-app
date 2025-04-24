-- Migration: resolve_report_content_overloading.sql

-- UP MIGRATION
BEGIN;

-- Drop the original function that doesn't have the other_participant_id parameter
DROP FUNCTION IF EXISTS public.report_content(text, uuid, text);

-- Keep only the new function that has the other_participant_id parameter
-- We don't need to recreate it since it already exists

COMMENT ON FUNCTION public.report_content(text, uuid, text, uuid) IS 'Reports content for moderation. Can report a letter or a specific reply thread with another participant.';

COMMIT;

-- DOWN MIGRATION
-- This would restore the original function if needed
BEGIN;

CREATE OR REPLACE FUNCTION public.report_content(p_content_type text, p_letter_id uuid, p_reason text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Validate content type
  IF p_content_type NOT IN ('letter', 'reply') THEN
    RAISE EXCEPTION 'Invalid content type: %', p_content_type;
  END IF;

  -- Insert the report
  INSERT INTO content_reports (
    reporter_id,
    content_type,
    letter_id,
    reason
  ) VALUES (
    auth.uid(),
    p_content_type,
    p_letter_id,
    p_reason
  )
  ON CONFLICT (reporter_id, letter_id, content_type) 
  DO UPDATE SET 
    reason = p_reason;
    
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$function$;

COMMENT ON FUNCTION public.report_content(text, uuid, text) IS 'Reports content for moderation.';

COMMIT;
