-- Drop existing trigger function
DROP FUNCTION IF EXISTS handle_new_reply();

-- Update handle_new_reply function to exclude notifications for blocked users
CREATE OR REPLACE FUNCTION handle_new_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_user_id uuid;
BEGIN
  -- The recipient is directly specified in the reply_to_user_id column
  -- Ensure this column is populated correctly when a reply is inserted.
  recipient_user_id := NEW.reply_to_user_id;

  -- Insert notification only if a recipient is specified and they are not the sender
  -- AND neither user has blocked the other
  IF recipient_user_id IS NOT NULL AND recipient_user_id != NEW.author_id 
  AND NOT EXISTS (
    -- Check if the recipient has blocked the author or the author has blocked the recipient
    SELECT 1 FROM user_blocks b
    WHERE (b.blocker_id = recipient_user_id AND b.blocked_id = NEW.author_id)
       OR (b.blocker_id = NEW.author_id AND b.blocked_id = recipient_user_id)
  ) THEN
    INSERT INTO public.notifications (recipient_id, sender_id, letter_id, reply_id, type)
    VALUES (recipient_user_id, NEW.author_id, NEW.letter_id, NEW.id, 'reply')
    ON CONFLICT (recipient_id, reply_id) DO NOTHING; -- Avoid duplicate notifications if trigger runs multiple times
  END IF;
  
  RETURN NEW;
END;
$$;
