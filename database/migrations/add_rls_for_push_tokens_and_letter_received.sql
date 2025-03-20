-- Add Row Level Security (RLS) policies for push_tokens and letter_received tables
-- This ensures that users can only access their own data

-- Push Tokens Table RLS
------------------------------------

-- First check if the push_tokens table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_tokens') THEN
    -- Enable RLS on push_tokens table
    ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
    
    -- Allow users to select only their own push tokens
    DROP POLICY IF EXISTS select_own_push_tokens ON public.push_tokens;
    CREATE POLICY select_own_push_tokens ON public.push_tokens 
      FOR SELECT USING (auth.uid() = user_id);
    
    -- Allow users to insert their own push tokens
    DROP POLICY IF EXISTS insert_own_push_tokens ON public.push_tokens;
    CREATE POLICY insert_own_push_tokens ON public.push_tokens 
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    -- Allow users to update their own push tokens
    DROP POLICY IF EXISTS update_own_push_tokens ON public.push_tokens;
    CREATE POLICY update_own_push_tokens ON public.push_tokens 
      FOR UPDATE USING (auth.uid() = user_id);
    
    -- Allow users to delete their own push tokens
    DROP POLICY IF EXISTS delete_own_push_tokens ON public.push_tokens;
    CREATE POLICY delete_own_push_tokens ON public.push_tokens 
      FOR DELETE USING (auth.uid() = user_id);
    
    RAISE NOTICE 'RLS policies added for push_tokens table';
  ELSE
    RAISE NOTICE 'push_tokens table does not exist, skipping RLS setup';
  END IF;
END $$;

-- Letter Received Table RLS
------------------------------------

-- Check if letter_received RLS is already set up (since we might have already added some policies)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'letter_received') THEN
    -- Enable RLS on letter_received table if not already enabled
    ALTER TABLE public.letter_received ENABLE ROW LEVEL SECURITY;
    
    -- Ensure all necessary policies exist
    
    -- Allow users to select their own received letters
    DROP POLICY IF EXISTS select_own_letter_received ON public.letter_received;
    CREATE POLICY select_own_letter_received ON public.letter_received 
      FOR SELECT USING (auth.uid() = user_id);
    
    -- Allow users to insert records of letters they received
    DROP POLICY IF EXISTS insert_own_letter_received ON public.letter_received;
    CREATE POLICY insert_own_letter_received ON public.letter_received 
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    -- Allow users to update their own letter_received records
    DROP POLICY IF EXISTS update_own_letter_received ON public.letter_received;
    CREATE POLICY update_own_letter_received ON public.letter_received 
      FOR UPDATE USING (auth.uid() = user_id);
    
    -- Allow users to delete their own letter_received records
    DROP POLICY IF EXISTS delete_own_letter_received ON public.letter_received;
    CREATE POLICY delete_own_letter_received ON public.letter_received 
      FOR DELETE USING (auth.uid() = user_id);
    
    RAISE NOTICE 'RLS policies added for letter_received table';
  ELSE
    RAISE NOTICE 'letter_received table does not exist, skipping RLS setup';
  END IF;
END $$;

-- Add a policy for service roles to access all records
-- This is important for backend functions that need to manage these tables
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_tokens') THEN
    DROP POLICY IF EXISTS allow_service_role_push_tokens ON public.push_tokens;
    CREATE POLICY allow_service_role_push_tokens ON public.push_tokens 
      FOR ALL TO service_role USING (true);
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'letter_received') THEN
    DROP POLICY IF EXISTS allow_service_role_letter_received ON public.letter_received;
    CREATE POLICY allow_service_role_letter_received ON public.letter_received 
      FOR ALL TO service_role USING (true);
  END IF;
END $$; 