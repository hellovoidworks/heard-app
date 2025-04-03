-- Migration: 20250403_add_delete_user_function.sql
-- Purpose: Add a database function to allow users to delete their own accounts

-- Start transaction
BEGIN;

-- Create a function that allows a user to delete their own account
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Get the user_id of the authenticated user
  _user_id := auth.uid();
  
  -- Validate that we have a user_id
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete the user from auth.users
  -- This will cascade to all tables that have foreign key relationships
  -- thanks to our previous migration that added CASCADE constraints
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- Grant usage of the function to all authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

COMMENT ON FUNCTION public.delete_user() IS 'Allows a user to delete their own account with proper cascading delete behavior';

-- Commit the transaction
COMMIT;
