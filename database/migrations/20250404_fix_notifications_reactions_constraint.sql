-- Migration: 20250404_fix_notifications_reactions_constraint.sql
-- Purpose: Fix foreign key constraints for cascading deletes

-- Start transaction
BEGIN;

-- Drop the existing constraint
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_reaction_id_fkey;
    
-- Add the constraint back with CASCADE delete rule
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_reaction_id_fkey
    FOREIGN KEY (reaction_id)
    REFERENCES public.reactions(id)
    ON DELETE CASCADE;

-- While we're here, let's also make sure the reply_id and letter_id foreign keys have CASCADE delete
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_reply_id_fkey;
    
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_reply_id_fkey
    FOREIGN KEY (reply_id)
    REFERENCES public.replies(id)
    ON DELETE CASCADE;

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_letter_id_fkey;
    
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_letter_id_fkey
    FOREIGN KEY (letter_id)
    REFERENCES public.letters(id)
    ON DELETE CASCADE;

-- Add CASCADE delete for recipient_id and sender_id if they reference users
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;
    
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey
    FOREIGN KEY (recipient_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey;
    
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_sender_id_fkey
    FOREIGN KEY (sender_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Fix the constraint between letter_reads and letters
ALTER TABLE public.letter_reads
    DROP CONSTRAINT IF EXISTS letter_reads_letter_id_fkey;
    
ALTER TABLE public.letter_reads
    ADD CONSTRAINT letter_reads_letter_id_fkey
    FOREIGN KEY (letter_id)
    REFERENCES public.letters(id)
    ON DELETE CASCADE;

-- Fix the constraint between reactions and letters
ALTER TABLE public.reactions
    DROP CONSTRAINT IF EXISTS reactions_letter_id_fkey;
    
ALTER TABLE public.reactions
    ADD CONSTRAINT reactions_letter_id_fkey
    FOREIGN KEY (letter_id)
    REFERENCES public.letters(id)
    ON DELETE CASCADE;

-- Fix category-related constraints
ALTER TABLE public.letters
    DROP CONSTRAINT IF EXISTS letters_category_id_fkey;
    
ALTER TABLE public.letters
    ADD CONSTRAINT letters_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id)
    ON DELETE SET NULL; -- Using SET NULL since a letter can exist without a category

ALTER TABLE public.user_category_preferences
    DROP CONSTRAINT IF EXISTS user_category_preferences_category_id_fkey;
    
ALTER TABLE public.user_category_preferences
    ADD CONSTRAINT user_category_preferences_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id)
    ON DELETE CASCADE; -- If a category is deleted, its preferences should be deleted

-- Commit the transaction
COMMIT;
