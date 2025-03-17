-- Migration to make the title field in the letters table optional
-- First, change the column to be nullable if it's not already
ALTER TABLE letters ALTER COLUMN title DROP NOT NULL;

-- Update any existing letters with empty titles to use the first part of content
UPDATE letters
SET title = (
  CASE 
    WHEN length(regexp_replace(split_part(content, E'\n', 1), '\s+', ' ', 'g')) > 50 
    THEN substr(regexp_replace(split_part(content, E'\n', 1), '\s+', ' ', 'g'), 1, 47) || '...'
    WHEN length(regexp_replace(split_part(content, E'\n', 1), '\s+', ' ', 'g')) < 3
    THEN 
      CASE 
        WHEN length(regexp_replace(content, '\s+', ' ', 'g')) > 50
        THEN substr(regexp_replace(content, '\s+', ' ', 'g'), 1, 47) || '...'
        ELSE regexp_replace(content, '\s+', ' ', 'g')
      END
    ELSE regexp_replace(split_part(content, E'\n', 1), '\s+', ' ', 'g')
  END
)
WHERE title IS NULL OR title = ''; 