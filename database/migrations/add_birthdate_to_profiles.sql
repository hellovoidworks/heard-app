-- Add birthdate column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birthdate TEXT;

-- Update the profile trigger to handle birthdate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_username TEXT;
BEGIN
  -- Generate a default username from email or use a fallback
  IF NEW.email IS NOT NULL THEN
    default_username := split_part(NEW.email, '@', 1);
  ELSE
    default_username := 'user_' || substr(md5(random()::text), 1, 8);
  END IF;

  -- Insert a new profile for the user
  INSERT INTO public.user_profiles (id, username, created_at, updated_at)
  VALUES (NEW.id, default_username, NOW(), NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 