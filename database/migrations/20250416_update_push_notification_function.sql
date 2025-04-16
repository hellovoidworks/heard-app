-- Function to handle sending push notifications with preference checks
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
  user_prefs JSONB;
  notifications_enabled BOOLEAN;
  specific_notification_enabled BOOLEAN;
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
  
  -- Get user notification preferences
  SELECT notification_preferences INTO user_prefs
  FROM user_profiles
  WHERE id = NEW.recipient_id;
  
  -- Check if notifications are enabled at all
  -- Default to false if preference doesn't exist or is null
  notifications_enabled := COALESCE((user_prefs->>'enabled')::BOOLEAN, FALSE);
  
  -- If notifications are disabled globally, exit early
  IF NOT notifications_enabled THEN
    RETURN NEW;
  END IF;
  
  -- Check specific notification type preference
  CASE notification_type
    WHEN 'reaction' THEN
      -- Check if reaction notifications are enabled, default to true if not specified
      specific_notification_enabled := COALESCE((user_prefs->>'reactions')::BOOLEAN, TRUE);
    WHEN 'reply' THEN
      -- Check if reply notifications are enabled, default to true if not specified
      specific_notification_enabled := COALESCE((user_prefs->>'replies')::BOOLEAN, TRUE);
    ELSE
      -- For unknown types, default to enabled
      specific_notification_enabled := TRUE;
  END CASE;
  
  -- If this specific notification type is disabled, exit early
  IF NOT specific_notification_enabled THEN
    RETURN NEW;
  END IF;
  
  -- Create notification content based on type
  CASE notification_type
    WHEN 'reaction' THEN
      notification_title := 'New Reaction';
      notification_body := sender_name || ' reacted to your letter "' || COALESCE(letter_title, 'Untitled') || '"';
    WHEN 'reply' THEN
      DECLARE
        letter_display_name TEXT;
        letter_author_id UUID;
      BEGIN
        -- Get the letter author ID and display_name
        SELECT author_id, display_name INTO letter_author_id, letter_display_name 
        FROM letters 
        WHERE id = NEW.letter_id;
        
        notification_title := 'New Reply';
        
        -- Use the letter's display_name if the reply is from the letter author,
        -- otherwise use the sender's username
        IF NEW.sender_id = letter_author_id THEN
          notification_body := letter_display_name || ' sent you a reply 👀';
        ELSE
          notification_body := sender_name || ' sent you a reply 👀';
        END IF;
      END;
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

-- Add a comment to the function
COMMENT ON FUNCTION public.handle_push_notification() IS 'Processes new notifications and queues push notifications based on user preferences. Handles reaction and reply notifications.';
