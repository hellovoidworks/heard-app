-- Add a new table to track which letters have been received by which users
-- This helps to implement the feature where users receive random letters periodically
-- The table stores when each letter was received by each user

-- Create the letter_received table
CREATE TABLE public.letter_received (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    
    -- Ensure each letter is only recorded once per user
    CONSTRAINT letter_received_user_letter_unique UNIQUE (user_id, letter_id)
);

-- Add indexes for performance
CREATE INDEX letter_received_user_id_idx ON public.letter_received(user_id);
CREATE INDEX letter_received_letter_id_idx ON public.letter_received(letter_id);
CREATE INDEX letter_received_received_at_idx ON public.letter_received(received_at);

-- Add RLS policies
ALTER TABLE public.letter_received ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own received letters
CREATE POLICY select_own_letter_received ON public.letter_received 
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own letter_received records
CREATE POLICY insert_own_letter_received ON public.letter_received 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER set_updated_at_letter_received
BEFORE UPDATE ON public.letter_received
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at(); 