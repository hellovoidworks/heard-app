-- Update handle_new_reply function to use reply_to_user_id for notifications

-- Function to handle inserting notifications when a new reply is created
CREATE OR REPLACE FUNCTION public.handle_new_reply()
RETURNS TRIGGER AS $$
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
    ON CONFLICT (recipient_id, reply_id) DO NOTHING; -- Avoid duplicate notifications if trigger runs multiple times?
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger (ensure it uses the latest function definition)
-- No change needed to the trigger definition itself, as it calls the function by name.
-- DROP TRIGGER IF EXISTS trigger_new_reply ON public.replies;
-- CREATE TRIGGER trigger_new_reply
-- AFTER INSERT ON public.replies
-- FOR EACH ROW EXECUTE FUNCTION public.handle_new_reply();

COMMENT ON FUNCTION public.handle_new_reply() IS 'Handles inserting a notification when a new reply is created, using the reply_to_user_id field to determine the recipient.';

