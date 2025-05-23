-- Migration to fix username uniqueness constraints
-- This version checks for existing constraints to avoid duplicates

-- First, remove our redundant constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_username_unique' 
    AND conrelid = 'user_profiles'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_username_unique';
    RAISE NOTICE 'Dropped redundant constraint user_profiles_username_unique';
  ELSE
    RAISE NOTICE 'Constraint user_profiles_username_unique does not exist, continuing';
  END IF;
END $$;

-- Keep the functions for checking username uniqueness

-- Create or replace function to check username uniqueness (can be called from triggers or RPC)
CREATE OR REPLACE FUNCTION check_username_uniqueness(new_username TEXT, user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF user_id IS NULL THEN
    -- Check if username exists at all
    SELECT COUNT(*) INTO existing_count
    FROM user_profiles
    WHERE username = new_username;
  ELSE
    -- Check if username exists for any user other than the specified one
    SELECT COUNT(*) INTO existing_count
    FROM user_profiles
    WHERE username = new_username
    AND id != user_id;
  END IF;
  
  RETURN existing_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to check if a username is available (can be called via RPC)
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT, current_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_username_uniqueness(check_username, current_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the trigger if it exists
DROP TRIGGER IF EXISTS enforce_username_uniqueness_trigger ON user_profiles;

-- Update the handle_new_user function to ensure unique usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_username TEXT;
  username_exists BOOLEAN;
  attempt_count INTEGER := 0;
  max_attempts INTEGER := 10;
  random_suffix TEXT;
BEGIN
  -- First try to use email prefix as username
  IF NEW.email IS NOT NULL THEN
    default_username := split_part(NEW.email, '@', 1);
  ELSE
    default_username := 'user';
  END IF;
  
  -- Check if username exists
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.user_profiles WHERE username = default_username
    ) INTO username_exists;
    
    -- If username doesn't exist or we've tried too many times, exit loop
    IF NOT username_exists OR attempt_count >= max_attempts THEN
      EXIT;
    END IF;
    
    -- Add random suffix to make username unique
    random_suffix := substr(md5(random()::text), 1, 8);
    default_username := default_username || random_suffix;
    attempt_count := attempt_count + 1;
  END LOOP;

  -- Insert a new profile for the user with default 10 stars
  INSERT INTO public.user_profiles (id, username, stars, created_at, updated_at)
  VALUES (NEW.id, default_username, 10, NOW(), NOW());
  
  RETURN NEW;
END;
$$;
