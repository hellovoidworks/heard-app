-- Create Users table extensions (Supabase already has a users table via auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  push_token TEXT,
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Letters table
CREATE TABLE IF NOT EXISTS letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category_id UUID NOT NULL,
  parent_id UUID,
  thread_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (parent_id) REFERENCES letters(id),
  FOREIGN KEY (thread_id) REFERENCES letters(id)
);

-- Create Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  letter_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, letter_id, reaction_type),
  FOREIGN KEY (letter_id) REFERENCES letters(id)
);

-- Create Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  sender_id UUID,
  letter_id UUID,
  reaction_id UUID,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (letter_id) REFERENCES letters(id),
  FOREIGN KEY (reaction_id) REFERENCES reactions(id)
);

-- Create User_Category_Preferences table
CREATE TABLE IF NOT EXISTS user_category_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category_id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create Letter_Reads table
CREATE TABLE IF NOT EXISTS letter_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  letter_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, letter_id),
  FOREIGN KEY (letter_id) REFERENCES letters(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_letters_author_id ON letters(author_id);
CREATE INDEX IF NOT EXISTS idx_letters_category_id ON letters(category_id);
CREATE INDEX IF NOT EXISTS idx_letters_parent_id ON letters(parent_id);
CREATE INDEX IF NOT EXISTS idx_letters_thread_id ON letters(thread_id);
CREATE INDEX IF NOT EXISTS idx_reactions_letter_id ON reactions(letter_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_letter_reads_user_id ON letter_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_letter_reads_letter_id ON letter_reads(letter_id);

-- Create trigger function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for letters table
DROP TRIGGER IF EXISTS update_letters_updated_at ON letters;
CREATE TRIGGER update_letters_updated_at
BEFORE UPDATE ON letters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create trigger function for notifications on new replies
CREATE OR REPLACE FUNCTION create_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
  original_author_id UUID;
BEGIN
  -- Only create notification if this is a reply (has parent_id)
  IF NEW.parent_id IS NOT NULL THEN
    -- Get the author of the parent letter
    SELECT author_id INTO original_author_id FROM letters WHERE id = NEW.parent_id;
    
    -- Don't notify if replying to your own letter
    IF original_author_id != NEW.author_id THEN
      INSERT INTO notifications (recipient_id, sender_id, letter_id, type)
      VALUES (original_author_id, NEW.author_id, NEW.id, 'reply');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reply notifications
DROP TRIGGER IF EXISTS on_new_reply ON letters;
CREATE TRIGGER on_new_reply
AFTER INSERT ON letters
FOR EACH ROW
EXECUTE FUNCTION create_reply_notification();

-- Create trigger function for notifications on new reactions
CREATE OR REPLACE FUNCTION create_reaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  letter_author_id UUID;
BEGIN
  -- Get the author of the letter being reacted to
  SELECT author_id INTO letter_author_id FROM letters WHERE id = NEW.letter_id;
  
  -- Don't notify if reacting to your own letter
  IF letter_author_id != NEW.user_id THEN
    INSERT INTO notifications (recipient_id, sender_id, letter_id, reaction_id, type)
    VALUES (letter_author_id, NEW.user_id, NEW.letter_id, NEW.id, 'reaction');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reaction notifications
DROP TRIGGER IF EXISTS on_new_reaction ON reactions;
CREATE TRIGGER on_new_reaction
AFTER INSERT ON reactions
FOR EACH ROW
EXECUTE FUNCTION create_reaction_notification();

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_category_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_reads ENABLE ROW LEVEL SECURITY;

-- User profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
CREATE POLICY "Users can view all profiles" 
ON user_profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" 
ON user_profiles FOR UPDATE 
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" 
ON user_profiles FOR INSERT 
WITH CHECK (id = auth.uid());

-- Letters policies
DROP POLICY IF EXISTS "Anyone can read letters" ON letters;
CREATE POLICY "Anyone can read letters" 
ON letters FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can create letters" ON letters;
CREATE POLICY "Users can create letters" 
ON letters FOR INSERT 
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own letters" ON letters;
CREATE POLICY "Users can update own letters" 
ON letters FOR UPDATE 
USING (author_id = auth.uid());

-- Reactions policies
DROP POLICY IF EXISTS "Anyone can read reactions" ON reactions;
CREATE POLICY "Anyone can read reactions" 
ON reactions FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can create reactions" ON reactions;
CREATE POLICY "Users can create reactions" 
ON reactions FOR INSERT 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Users can delete own reactions" 
ON reactions FOR DELETE 
USING (user_id = auth.uid());

-- Notifications policies
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" 
ON notifications FOR SELECT 
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (recipient_id = auth.uid());

-- User category preferences policies
DROP POLICY IF EXISTS "Users can manage own category preferences" ON user_category_preferences;
CREATE POLICY "Users can manage own category preferences" 
ON user_category_preferences FOR ALL
USING (user_id = auth.uid());

-- Letter reads policies
DROP POLICY IF EXISTS "Users can manage own letter reads" ON letter_reads;
CREATE POLICY "Users can manage own letter reads" 
ON letter_reads FOR ALL
USING (user_id = auth.uid());

-- Add some initial categories
INSERT INTO categories (name, description)
VALUES 
  ('Personal', 'Share your personal stories and experiences'),
  ('Advice', 'Ask for or give advice on various topics'),
  ('Gratitude', 'Express gratitude and appreciation'),
  ('Reflection', 'Thoughtful reflections on life and experiences'),
  ('Support', 'Seek or offer emotional support')
ON CONFLICT (name) DO NOTHING; 