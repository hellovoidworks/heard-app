-- Migration to fix references to the removed parent_id field
-- This script removes the old reply notification trigger and function
-- since we now handle replies through the dedicated replies table

-- First, drop the trigger from the letters table
DROP TRIGGER IF EXISTS on_new_reply ON letters;

-- Then drop the function that was using parent_id
DROP FUNCTION IF EXISTS create_reply_notification();

-- Also drop the old get_reply_counts function as it's obsolete
DROP FUNCTION IF EXISTS get_reply_counts(UUID[]);

-- And finally drop any indexes related to parent_id if they still exist
DROP INDEX IF EXISTS idx_letters_parent_id;
DROP INDEX IF EXISTS idx_letters_thread_id;

-- Consider updating any functions that might have been using these
-- and replace them with the newer versions that use the replies table 