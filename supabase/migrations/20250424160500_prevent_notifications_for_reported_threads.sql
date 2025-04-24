-- Migration: prevent_notifications_for_reported_threads.sql

-- UP MIGRATION
BEGIN;

COMMENT ON FUNCTION public.handle_new_reply IS 'Trigger function that creates notifications when a new reply is added. Now includes logic to prevent notifications for threads that have been reported by the recipient.';

CREATE OR REPLACE FUNCTION public.handle_new_reply()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $function$
DECLARE
  recipient_user_id uuid;
BEGIN
  -- The recipient is directly specified in the reply_to_user_id column
  -- Ensure this column is populated correctly when a reply is inserted.
  recipient_user_id := NEW.reply_to_user_id;

  -- Insert notification only if a recipient is specified and they are not the sender
  IF recipient_user_id IS NOT NULL AND recipient_user_id != NEW.author_id THEN
    -- Check if the recipient has reported this specific conversation
    IF NOT EXISTS (
      SELECT 1 
      FROM content_reports
      WHERE reporter_id = recipient_user_id        -- The recipient is the one who reported
        AND letter_id = NEW.letter_id              -- For this specific letter
        AND content_type = 'reply'                 -- As a conversation/thread report
        AND other_participant_id = NEW.author_id   -- And they reported this specific sender
    ) THEN
      -- Only proceed with notification if no report exists
      INSERT INTO public.notifications (recipient_id, sender_id, letter_id, reply_id, type)
      VALUES (recipient_user_id, NEW.author_id, NEW.letter_id, NEW.id, 'reply')
      ON CONFLICT (recipient_id, reply_id) DO NOTHING; -- Avoid duplicate notifications if trigger runs multiple times
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

COMMIT;

-- DOWN MIGRATION
-- Restores the original function in case of rollback
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_reply()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $function$
DECLARE
  recipient_user_id uuid;
BEGIN
  -- The recipient is directly specified in the reply_to_user_id column
  -- Ensure this column is populated correctly when a reply is inserted.
  recipient_user_id := NEW.reply_to_user_id;

  -- Insert notification only if a recipient is specified and they are not the sender
  IF recipient_user_id IS NOT NULL AND recipient_user_id != NEW.author_id THEN
    INSERT INTO public.notifications (recipient_id, sender_id, letter_id, reply_id, type)
    VALUES (recipient_user_id, NEW.author_id, NEW.letter_id, NEW.id, 'reply')
    ON CONFLICT (recipient_id, reply_id) DO NOTHING; -- Avoid duplicate notifications if trigger runs multiple times
  END IF;
  
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_reply IS 'Trigger function that creates notifications when a new reply is added.';

COMMIT;
