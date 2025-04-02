-- Update the get_my_letters_with_stats function to correctly count views
-- by running with definer privileges, bypassing RLS on letter_reads.

ALTER FUNCTION public.get_my_letters_with_stats(user_id uuid)
  SECURITY DEFINER;

-- Optional: Grant execute permission to authenticated users if needed
-- GRANT EXECUTE ON FUNCTION public.get_my_letters_with_stats(uuid) TO authenticated;
