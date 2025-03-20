-- Add display_order column to the letter_received table
-- This helps maintain a consistent order when displaying letters to users

-- First check if display_order column already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'letter_received'
    AND column_name = 'display_order'
  ) THEN
    -- Add the display_order column with a default value
    ALTER TABLE public.letter_received 
    ADD COLUMN display_order INTEGER DEFAULT 0;
    
    -- Create an index for better performance when sorting by display_order
    CREATE INDEX letter_received_display_order_idx ON public.letter_received(user_id, display_order);
    
    RAISE NOTICE 'Added display_order column to letter_received table';
  ELSE
    RAISE NOTICE 'display_order column already exists in letter_received table';
  END IF;
END $$; 