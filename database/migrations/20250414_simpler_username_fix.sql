-- Migration to fix username generation and remove redundant constraints
-- This is a simpler, more reliable approach

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

-- Remove the trigger if it exists
DROP TRIGGER IF EXISTS enforce_username_uniqueness_trigger ON user_profiles;

-- Function to check if a username is available
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT, current_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    -- Check if username exists at all
    SELECT COUNT(*) INTO existing_count
    FROM user_profiles
    WHERE username = check_username;
  ELSE
    -- Check if username exists for any user other than the specified one
    SELECT COUNT(*) INTO existing_count
    FROM user_profiles
    WHERE username = check_username
    AND id != current_user_id;
  END IF;
  
  RETURN existing_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the handle_new_user function with a simpler approach
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  adjectives TEXT[] := ARRAY['Amber','Azure','Bright','Calm','Coral','Crystal','Dapper','Deep','Eager','Emerald','Fancy','Gentle','Golden','Happy','Indigo','Jade','Jolly','Kind','Lively','Loyal','Lucky','Mellow','Mighty','Noble','Olive','Opal','Peaceful','Plum','Proud','Purple','Quiet','Royal','Ruby','Sage','Sapphire','Scarlet','Serene','Silver','Smooth','Sunny','Swift','Teal','Tranquil','Violet','Vivid','Warm','Wise','Witty'];
  
  nouns TEXT[] := ARRAY['Aura','Beam','Bloom','Bliss','Breeze','Brook','Cloud','Coral','Crown','Dawn','Dream','Echo','Ember','Fern','Flame','Flare','Flash','Flower','Galaxy','Garden','Gem','Glade','Glow','Harbor','Heart','Isle','Jewel','Joy','Leaf','Light','Lily','Lotus','Meadow','Mist','Moon','Ocean','Opal','Petal','Rain','Rainbow','River','Rose','Sky','Spark','Star','Stream','Sun','Thunder','Wave','Wind'];
  
  base_username TEXT;
  final_username TEXT;
  username_exists BOOLEAN;
  random_number TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 20;
BEGIN
  -- Create a base username from a random adjective and noun
  base_username := 
    adjectives[1 + floor(random() * array_length(adjectives, 1))] || 
    nouns[1 + floor(random() * array_length(nouns, 1))];
  
  -- Try up to max_attempts times to find a unique username
  LOOP
    -- Generate a random 4-digit number
    random_number := lpad(floor(random() * 10000)::text, 4, '0');
    
    -- Create the username with number suffix
    final_username := base_username || random_number;
    
    -- Check if username exists
    SELECT EXISTS (
      SELECT 1 FROM public.user_profiles WHERE username = final_username
    ) INTO username_exists;
    
    -- Exit loop if username is unique or we've tried too many times
    EXIT WHEN NOT username_exists OR attempts >= max_attempts;
    
    attempts := attempts + 1;
  END LOOP;
  
  -- Insert user profile with the generated username
  BEGIN
    INSERT INTO public.user_profiles (id, username, stars, created_at, updated_at)
    VALUES (NEW.id, final_username, 10, NOW(), NOW());
  EXCEPTION WHEN others THEN
    -- Fallback to a timestamp-based username if all else fails
    INSERT INTO public.user_profiles (id, username, stars, created_at, updated_at)
    VALUES (
      NEW.id, 
      'User' || to_char(NOW(), 'YYYYMMDDHH24MISS') || substring(md5(random()::text), 1, 4), 
      10, 
      NOW(), 
      NOW()
    );
  END;
  
  RETURN NEW;
END;
$$;
