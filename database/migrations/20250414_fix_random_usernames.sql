-- Migration to implement two-word random usernames (like StarlightBright)
-- This version removes the redundant constraint and updates handle_new_user

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

-- Create functions for generating random usernames and checking uniqueness

-- Function to generate a random two-word username
CREATE OR REPLACE FUNCTION generate_random_username()
RETURNS TEXT AS $$
DECLARE
  adjectives TEXT[] := ARRAY[
    'Amber', 'Azure', 'Bright', 'Calm', 'Clever', 'Coral', 'Crimson', 'Crystal',
    'Dapper', 'Deep', 'Eager', 'Elated', 'Emerald', 'Fancy', 'Gentle', 'Glad',
    'Golden', 'Happy', 'Humble', 'Indigo', 'Jade', 'Jolly', 'Kind', 'Lively',
    'Loyal', 'Lucky', 'Mellow', 'Mighty', 'Noble', 'Olive', 'Opal', 'Peaceful',
    'Plum', 'Proud', 'Purple', 'Quiet', 'Royal', 'Ruby', 'Sage', 'Sapphire',
    'Scarlet', 'Serene', 'Silver', 'Smooth', 'Sunny', 'Swift', 'Teal', 'Tranquil',
    'Violet', 'Vivid', 'Warm', 'Wise', 'Witty', 'Zesty'
  ];
  
  nouns TEXT[] := ARRAY[
    'Aura', 'Beam', 'Bloom', 'Bliss', 'Breeze', 'Brook', 'Charm', 'Cloud',
    'Clover', 'Coral', 'Crest', 'Crown', 'Dawn', 'Dew', 'Dream', 'Echo',
    'Ember', 'Fern', 'Flame', 'Flare', 'Flash', 'Flower', 'Forest', 'Galaxy',
    'Garden', 'Gem', 'Glade', 'Glow', 'Harbor', 'Harmony', 'Haven', 'Heart',
    'Horizon', 'Isle', 'Jewel', 'Joy', 'Leaf', 'Light', 'Lily', 'Lotus',
    'Meadow', 'Mist', 'Moon', 'Mountain', 'Ocean', 'Opal', 'Petal', 'Phoenix',
    'Rain', 'Rainbow', 'River', 'Rose', 'Sky', 'Spark', 'Star', 'Stream',
    'Sun', 'Thunder', 'Tide', 'Wave', 'Willow', 'Wind', 'Wing', 'Wonder'
  ];
  
  random_adjective TEXT;
  random_noun TEXT;
BEGIN
  -- Select a random adjective and noun
  random_adjective := adjectives[floor(random() * array_length(adjectives, 1)) + 1];
  random_noun := nouns[floor(random() * array_length(nouns, 1)) + 1];
  
  -- Combine them into a username
  RETURN random_adjective || random_noun;
END;
$$ LANGUAGE plpgsql;

-- Function to check username uniqueness
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

-- Function to generate a unique random username
CREATE OR REPLACE FUNCTION generate_unique_random_username()
RETURNS TEXT AS $$
DECLARE
  username TEXT;
  is_unique BOOLEAN;
  attempt_count INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Try to generate a unique username up to max_attempts times
  LOOP
    username := generate_random_username();
    
    -- Check if the username is unique
    SELECT check_username_uniqueness(username) INTO is_unique;
    
    -- If unique or we've tried too many times, exit the loop
    IF is_unique OR attempt_count >= max_attempts THEN
      EXIT;
    END IF;
    
    attempt_count := attempt_count + 1;
  END LOOP;
  
  -- If we couldn't find a unique username, add a random number
  IF NOT is_unique THEN
    username := username || floor(random() * 1000);
  END IF;
  
  RETURN username;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a username is available (can be called via RPC)
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT, current_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_username_uniqueness(check_username, current_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the trigger if it exists
DROP TRIGGER IF EXISTS enforce_username_uniqueness_trigger ON user_profiles;

-- Update the handle_new_user function to use two-word random usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  random_username TEXT;
BEGIN
  -- Generate a unique random two-word username
  random_username := generate_unique_random_username();
  
  -- Insert a new profile for the user with default 10 stars
  INSERT INTO public.user_profiles (id, username, stars, created_at, updated_at)
  VALUES (NEW.id, random_username, 10, NOW(), NOW());
  
  RETURN NEW;
END;
$$;
