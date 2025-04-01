-- Update the handle_push_notification function to change reply notification text
CREATE OR REPLACE FUNCTION public.handle_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sender_name TEXT;
  notification_type TEXT;
  notification_title TEXT;
  notification_body TEXT;
  letter_title TEXT;
BEGIN
  -- Get notification type
  notification_type := NEW.type;
  
  -- Get sender name
  SELECT username INTO sender_name 
  FROM user_profiles 
  WHERE id = NEW.sender_id;
  
  -- Get letter title if applicable
  IF NEW.letter_id IS NOT NULL THEN
    SELECT title INTO letter_title 
    FROM letters 
    WHERE id = NEW.letter_id;
  END IF;
  
  -- Create notification content based on type
  CASE notification_type
    WHEN 'reaction' THEN
      notification_title := 'New Reaction';
      notification_body := sender_name || ' reacted to your letter "' || COALESCE(letter_title, 'Untitled') || '"';
    WHEN 'reply' THEN
      notification_title := 'New Reply';
      notification_body := sender_name || ' sent you a reply 👀';
    WHEN 'letter' THEN
      notification_title := 'New Letter';
      notification_body := 'You received a new letter from ' || sender_name;
    ELSE
      notification_title := 'New Notification';
      notification_body := 'You have a new notification in Heard App';
  END CASE;
  
  -- Insert into push_notification_queue for processing by Edge Function
  INSERT INTO push_notification_queue (
    user_id, 
    title, 
    body, 
    data
  ) VALUES (
    NEW.recipient_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'notification_id', NEW.id,
      'type', notification_type,
      'letter_id', NEW.letter_id,
      'sender_id', NEW.sender_id
    )
  );
  
  RETURN NEW;
END;
$$;
