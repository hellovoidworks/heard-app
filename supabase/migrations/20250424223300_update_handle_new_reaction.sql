-- Drop existing trigger function
DROP FUNCTION IF EXISTS handle_new_reaction();

-- Update handle_new_reaction function to exclude notifications for blocked users
CREATE OR REPLACE FUNCTION handle_new_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert a notification for the letter author, but only if neither user has blocked the other
  INSERT INTO public.notifications (recipient_id, sender_id, letter_id, type)
  SELECT l.author_id, NEW.user_id, NEW.letter_id, 'reaction'
  FROM public.letters l
  WHERE l.id = NEW.letter_id 
    AND l.author_id != NEW.user_id
    AND NOT EXISTS (
      -- Check if the letter author has blocked the reactor or the reactor has blocked the author
      SELECT 1 FROM user_blocks b
      WHERE (b.blocker_id = l.author_id AND b.blocked_id = NEW.user_id)
         OR (b.blocker_id = NEW.user_id AND b.blocked_id = l.author_id)
    );
  
  RETURN NEW;
END;
$$;
