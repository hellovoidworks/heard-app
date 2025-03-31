-- Function to handle sending push notifications
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
      notification_body := sender_name || ' replied to your letter "' || COALESCE(letter_title, 'Untitled') || '"';
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

-- Create a table to queue push notifications for processing
CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Create index for faster processing
CREATE INDEX IF NOT EXISTS push_notification_queue_processed_idx ON public.push_notification_queue(processed);
CREATE INDEX IF NOT EXISTS push_notification_queue_user_id_idx ON public.push_notification_queue(user_id);

-- Create trigger to call the function when a new notification is created
DROP TRIGGER IF EXISTS on_new_notification ON public.notifications;
CREATE TRIGGER on_new_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_push_notification();

-- Create a function to process the push notification queue
CREATE OR REPLACE FUNCTION public.process_push_notification_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_count INTEGER := 0;
BEGIN
  -- Mark notifications as processed
  -- In a real implementation, this would be called by a scheduled job
  -- or by the Edge Function after successfully sending the notifications
  UPDATE push_notification_queue
  SET processed = TRUE, processed_at = NOW()
  WHERE processed = FALSE;
  
  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RETURN notification_count;
END;
$$;
