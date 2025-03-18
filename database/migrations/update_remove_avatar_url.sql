-- Migration to effectively remove avatar_url from user_profiles
-- We'll comment it out rather than dropping it to maintain backward compatibility

-- Comment out the avatar_url column
COMMENT ON COLUMN user_profiles.avatar_url IS 'Deprecated: This column is no longer used by the application';

-- Update any existing profiles with avatar_url to set it to NULL
UPDATE user_profiles
SET avatar_url = NULL; 