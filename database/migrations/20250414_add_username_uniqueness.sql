-- Migration to add uniqueness constraint to usernames in user_profiles table
-- This ensures no two users can have the same username

-- First, check if there are any duplicate usernames currently in the database
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT username, COUNT(*) 
    FROM user_profiles 
    GROUP BY username 
    HAVING COUNT(*) > 1
  ) AS duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'There are % duplicate usernames in the database. Please resolve these before adding the uniqueness constraint.', duplicate_count;
  END IF;
END $$;

-- Add the uniqueness constraint
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_username_unique UNIQUE (username);

-- Create a function to check username uniqueness that can be called from triggers or RPC
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

-- Create a trigger to enforce username uniqueness on insert/update
CREATE OR REPLACE FUNCTION enforce_username_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- If username is being updated
  IF TG_OP = 'UPDATE' AND NEW.username <> OLD.username THEN
    -- Check if the new username is unique
    IF NOT check_username_uniqueness(NEW.username, NEW.id) THEN
      RAISE EXCEPTION 'Username % is already taken', NEW.username;
    END IF;
  -- If this is a new user
  ELSIF TG_OP = 'INSERT' THEN
    -- Check if the username is unique
    IF NOT check_username_uniqueness(NEW.username) THEN
      RAISE EXCEPTION 'Username % is already taken', NEW.username;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS enforce_username_uniqueness_trigger ON user_profiles;

-- Create the trigger
CREATE TRIGGER enforce_username_uniqueness_trigger
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_username_uniqueness();

-- Create a function to check if a username is available (can be called via RPC)
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT, current_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_username_uniqueness(check_username, current_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
