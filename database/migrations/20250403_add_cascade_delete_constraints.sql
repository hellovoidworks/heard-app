-- Migration: 20250403_add_cascade_delete_constraints.sql
-- Purpose: Add missing foreign key constraints with CASCADE delete rules to enable proper user deletion

-- Start transaction
BEGIN;

-- Add foreign key constraints with CASCADE delete to letter_reads table
ALTER TABLE IF EXISTS public.letter_reads
    DROP CONSTRAINT IF EXISTS letter_reads_user_id_fkey;
    
ALTER TABLE IF EXISTS public.letter_reads
    ADD CONSTRAINT letter_reads_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add foreign key constraints with CASCADE delete to letter_received table
ALTER TABLE IF EXISTS public.letter_received
    DROP CONSTRAINT IF EXISTS letter_received_user_id_fkey;
    
ALTER TABLE IF EXISTS public.letter_received
    ADD CONSTRAINT letter_received_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add foreign key constraints with CASCADE delete to push_notification_queue table
ALTER TABLE IF EXISTS public.push_notification_queue
    DROP CONSTRAINT IF EXISTS push_notification_queue_user_id_fkey;
    
ALTER TABLE IF EXISTS public.push_notification_queue
    ADD CONSTRAINT push_notification_queue_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add foreign key constraints with CASCADE delete to push_tokens table
ALTER TABLE IF EXISTS public.push_tokens
    DROP CONSTRAINT IF EXISTS push_tokens_user_id_fkey;
    
ALTER TABLE IF EXISTS public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add foreign key constraints with CASCADE delete to reactions table
ALTER TABLE IF EXISTS public.reactions
    DROP CONSTRAINT IF EXISTS reactions_user_id_fkey;
    
ALTER TABLE IF EXISTS public.reactions
    ADD CONSTRAINT reactions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add foreign key constraints with CASCADE delete to reply_reads table
ALTER TABLE IF EXISTS public.reply_reads
    DROP CONSTRAINT IF EXISTS reply_reads_user_id_fkey;
    
ALTER TABLE IF EXISTS public.reply_reads
    ADD CONSTRAINT reply_reads_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add foreign key constraints with CASCADE delete to user_category_preferences table
ALTER TABLE IF EXISTS public.user_category_preferences
    DROP CONSTRAINT IF EXISTS user_category_preferences_user_id_fkey;
    
ALTER TABLE IF EXISTS public.user_category_preferences
    ADD CONSTRAINT user_category_preferences_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Check if replies table needs a foreign key for reply_to_user_id
ALTER TABLE IF EXISTS public.replies
    DROP CONSTRAINT IF EXISTS replies_reply_to_user_id_fkey;
    
ALTER TABLE IF EXISTS public.replies
    ADD CONSTRAINT replies_reply_to_user_id_fkey
    FOREIGN KEY (reply_to_user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- Commit the transaction
COMMIT;
