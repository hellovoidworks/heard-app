-- Migration to update foreign key relationships in the database
-- This migration adds proper foreign key constraints to tables

-- Update user_profiles table to reference auth.users
ALTER TABLE user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_pkey,
  ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update letters table to reference user_profiles
ALTER TABLE letters
  DROP CONSTRAINT IF EXISTS letters_author_id_fkey,
  ADD CONSTRAINT letters_author_id_fkey FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Update notifications table to reference user_profiles
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey,
  ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey,
  ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Update user_category_preferences table to reference user_profiles
ALTER TABLE user_category_preferences
  DROP CONSTRAINT IF EXISTS user_category_preferences_user_id_fkey,
  ADD CONSTRAINT user_category_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Update letter_reads table to reference user_profiles
ALTER TABLE letter_reads
  DROP CONSTRAINT IF EXISTS letter_reads_user_id_fkey,
  ADD CONSTRAINT letter_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Update reactions table to reference user_profiles
ALTER TABLE reactions
  DROP CONSTRAINT IF EXISTS reactions_user_id_fkey,
  ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Add notification_preferences column to user_profiles if it doesn't exist
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS push_token,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"enabled": false}'::JSONB,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'age_verification';

-- Create push_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Create function to get reply counts
CREATE OR REPLACE FUNCTION get_reply_counts(letter_ids UUID[])
RETURNS TABLE (parent_id UUID, count TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    letters.parent_id,
    COUNT(letters.id)::TEXT
  FROM 
    letters
  WHERE 
    letters.parent_id = ANY(letter_ids)
  GROUP BY 
    letters.parent_id;
END;
$$ LANGUAGE plpgsql; 