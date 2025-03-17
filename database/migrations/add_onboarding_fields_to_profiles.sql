-- Add onboarding fields to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE; 