-- Migration to implement three-word random usernames with compulsory random number (like BrightSkyFlower1234)
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

-- Function to generate a random three-word username with a random number
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
  
  verbs TEXT[] := ARRAY[
    'Admire', 'Adore', 'Amaze', 'Ascend', 'Bask', 'Beam', 'Bloom', 'Blossom',
    'Captivate', 'Care', 'Charm', 'Cheer', 'Cherish', 'Create', 'Dance', 'Dare',
    'Delight', 'Dream', 'Drift', 'Elevate', 'Embrace', 'Enchant', 'Enjoy', 'Enrich',
    'Explore', 'Flow', 'Flourish', 'Fly', 'Gather', 'Gaze', 'Gleam', 'Glide',
    'Glow', 'Grow', 'Guide', 'Harmonize', 'Hope', 'Illuminate', 'Imagine', 'Inspire',
    'Journey', 'Jubilate', 'Kindle', 'Laugh', 'Launch', 'Leap', 'Nurture', 'Observe',
    'Radiate', 'Realize', 'Reflect', 'Rejoice', 'Rise', 'Sail', 'Shine', 'Soar',
    'Swim', 'Thrive', 'Treasure', 'Twinkle', 'Uplift', 'Venture', 'Wander', 'Wonder'
  ];
  
  random_adjective TEXT;
  random_noun TEXT;
  random_verb TEXT;
  random_number TEXT;
BEGIN
  -- Select random words
  random_adjective := adjectives[floor(random() * array_length(adjectives, 1)) + 1];
  random_noun := nouns[floor(random() * array_length(nouns, 1)) + 1];
  random_verb := verbs[floor(random() * array_length(verbs, 1)) + 1];
  
  -- Generate a random 4-digit number (0-9999)
  -- Format with leading zeros to ensure 4 digits
  random_number := lpad(floor(random() * 10000)::text, 4, '0');
  
  -- Combine them into a username
  RETURN random_adjective || random_noun || random_verb || random_number;
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

-- Function to check if a username is available (can be called via RPC)
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT, current_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_username_uniqueness(check_username, current_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the trigger if it exists
DROP TRIGGER IF EXISTS enforce_username_uniqueness_trigger ON user_profiles;

-- Update the handle_new_user function to use three-word random usernames with a random number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  random_username TEXT;
BEGIN
  -- Generate a unique random username (three words + number)
  random_username := generate_random_username();
  
  -- Insert a new profile for the user with default 10 stars
  INSERT INTO public.user_profiles (id, username, stars, created_at, updated_at)
  VALUES (NEW.id, random_username, 10, NOW(), NOW());
  
  RETURN NEW;
END;
$$;
