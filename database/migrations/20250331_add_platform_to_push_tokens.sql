-- Add platform column to push_tokens table
ALTER TABLE push_tokens
ADD COLUMN platform TEXT;

-- Update existing tokens to have 'ios' as platform since that's what we're using
UPDATE push_tokens
SET platform = 'ios';

-- Add a comment explaining the column
COMMENT ON COLUMN push_tokens.platform IS 'The platform of the device (ios, android, web)';
