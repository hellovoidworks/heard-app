-- Migration to remove deprecated fields from letters table
-- Since we have moved to using a dedicated replies table, these fields are no longer needed

-- First, ensure we have a function to migrate existing replies to the new format
DO $$
DECLARE
    letter_record RECORD;
    parent_letter RECORD;
BEGIN
    -- Check if the replies table exists and has been populated
    IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'replies') > 0 THEN
        -- Migrate any replies (letters with parent_id) to the replies table if not already there
        FOR letter_record IN 
            SELECT id, parent_id, author_id, display_name, content, created_at 
            FROM letters 
            WHERE parent_id IS NOT NULL
        LOOP
            -- Check if this letter already has a corresponding entry in the replies table
            IF NOT EXISTS (
                SELECT 1 FROM replies WHERE letter_id = letter_record.parent_id AND content = letter_record.content
            ) THEN
                -- Insert into replies table
                INSERT INTO replies (
                    letter_id, 
                    author_id, 
                    display_name, 
                    content,
                    created_at
                ) VALUES (
                    letter_record.parent_id,
                    letter_record.author_id,
                    letter_record.display_name,
                    letter_record.content,
                    letter_record.created_at
                );
                
                -- Log the migration
                RAISE NOTICE 'Migrated letter % as a reply to letter %', letter_record.id, letter_record.parent_id;
            END IF;
        END LOOP;
    ELSE
        RAISE EXCEPTION 'The replies table does not exist. Please run the create_replies_table migration first.';
    END IF;
END $$;

-- Drop the foreign key constraints
ALTER TABLE letters DROP CONSTRAINT IF EXISTS letters_parent_id_fkey;
ALTER TABLE letters DROP CONSTRAINT IF EXISTS letters_thread_id_fkey;

-- Drop the indexes
DROP INDEX IF EXISTS idx_letters_parent_id;
DROP INDEX IF EXISTS idx_letters_thread_id;

-- Now drop the columns
ALTER TABLE letters DROP COLUMN IF EXISTS parent_id;
ALTER TABLE letters DROP COLUMN IF EXISTS thread_id;
ALTER TABLE letters DROP COLUMN IF EXISTS recipient_id; 