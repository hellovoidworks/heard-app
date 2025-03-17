# Database Documentation for Heard App

This directory contains all database-related files for the Heard App, a community letter exchange platform.

## Database Setup Instructions

To set up the database manually:

1. Log in to your Supabase dashboard at https://app.supabase.com/
2. Select your project
3. Go to the "SQL Editor" section in the left sidebar
4. Create a new query
5. Copy and paste the contents of `supabase_setup.sql` into the SQL Editor
6. Click "Run" to execute the script

This will create all the necessary tables, indexes, triggers, and Row-Level Security (RLS) policies for your app.

## Files in this Directory

- `supabase_setup.sql` - Initial database schema setup script

## Database Schema

The database schema includes the following tables:

1. **user_profiles**: Extended user information
   - `id` (UUID, primary key)
   - `username` (string)
   - `avatar_url` (string)
   - `push_token` (string)
   - `notification_preferences` (JSON)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

2. **categories**: Letter categories
   - `id` (UUID, primary key)
   - `name` (string)
   - `description` (string)
   - `created_at` (timestamp)

3. **letters**: The main content table
   - `id` (UUID, primary key)
   - `author_id` (UUID, foreign key to users.id)
   - `display_name` (string) - Custom name shown for this letter
   - `title` (string)
   - `content` (text)
   - `category_id` (UUID, foreign key to categories.id)
   - `parent_id` (UUID, foreign key to letters.id, nullable) - For replies
   - `thread_id` (UUID, foreign key to letters.id, nullable) - For tracking threads
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

4. **reactions**: User reactions to letters
   - `id` (UUID, primary key)
   - `user_id` (UUID, foreign key to users.id)
   - `letter_id` (UUID, foreign key to letters.id)
   - `reaction_type` (string)
   - `created_at` (timestamp)

5. **notifications**: System notifications
   - `id` (UUID, primary key)
   - `recipient_id` (UUID, foreign key to users.id)
   - `sender_id` (UUID, foreign key to users.id, nullable)
   - `letter_id` (UUID, foreign key to letters.id, nullable)
   - `reaction_id` (UUID, foreign key to reactions.id, nullable)
   - `type` (string)
   - `read` (boolean)
   - `created_at` (timestamp)

6. **user_category_preferences**: User preferences for categories
   - `id` (UUID, primary key)
   - `user_id` (UUID, foreign key to users.id)
   - `category_id` (UUID, foreign key to categories.id)
   - `created_at` (timestamp)

7. **letter_reads**: Tracking which users have read which letters
   - `id` (UUID, primary key)
   - `user_id` (UUID, foreign key to users.id)
   - `letter_id` (UUID, foreign key to letters.id)
   - `read_at` (timestamp)
   - `created_at` (timestamp) 