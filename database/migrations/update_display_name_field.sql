-- Migration to update display_name handling in letters table
-- We'll comment out the is_anonymous field and ensure display_name is properly set

-- Comment out the is_anonymous column
COMMENT ON COLUMN letters.is_anonymous IS 'Deprecated: This column is no longer used, display_name is used directly instead';

-- Ensure display_name field exists and is NOT NULL
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE letters ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Anonymous';
  END IF;
END $$;

-- Update existing letters to set display_name based on author's username where display_name is missing or empty
UPDATE letters l
SET display_name = u.username
FROM user_profiles u
WHERE l.author_id = u.id
AND (l.display_name IS NULL OR l.display_name = '' OR l.display_name = 'Anonymous')
AND l.is_anonymous = FALSE;

-- For any remaining letters with is_anonymous = TRUE but no display_name, set to 'Anonymous'
UPDATE letters
SET display_name = 'Anonymous'
WHERE (display_name IS NULL OR display_name = '')
AND is_anonymous = TRUE; 