-- Update RLS policy for letter_reads to allow any authenticated user read access.
-- This fixes the view count display in MyLettersTab.

-- Drop any existing select policy first to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.letter_reads;

-- Create a policy allowing any authenticated user to read all rows
CREATE POLICY "Allow authenticated read access"
ON public.letter_reads
FOR SELECT
USING (auth.role() = 'authenticated');
