-- Migration to add mood_emoji column to letters table
ALTER TABLE letters
ADD COLUMN IF NOT EXISTS mood_emoji TEXT;

-- Update RLS policies to allow writing to the new column
DROP POLICY IF EXISTS "Users can create letters" ON letters;
CREATE POLICY "Users can create letters" 
ON letters FOR INSERT 
WITH CHECK (author_id = auth.uid());

-- Update the letters table indexes
CREATE INDEX IF NOT EXISTS idx_letters_mood_emoji ON letters(mood_emoji); 