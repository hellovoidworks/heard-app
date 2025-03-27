-- Add stars column to user_profiles table with default value of 10
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stars INTEGER DEFAULT 10;

-- Update existing profiles to have 10 stars if they don't have any
UPDATE user_profiles SET stars = 10 WHERE stars IS NULL;

-- Update the profile trigger to handle stars
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

  -- Insert a new profile for the user with default 10 stars
  INSERT INTO public.user_profiles (id, username, stars, created_at, updated_at)
  VALUES (NEW.id, default_username, 10, NOW(), NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 