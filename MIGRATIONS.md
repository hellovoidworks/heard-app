# How to Apply Database Migrations in Supabase

This document explains how to apply database migrations manually using the Supabase Studio web interface.

## Applying the Reactions Table Migration

To apply the `20240527_create_reactions_table.sql` migration, follow these steps:

1. Log in to your Supabase account at https://app.supabase.com/
2. Select your project from the dashboard
3. In the left sidebar, navigate to "SQL Editor"
4. Click on "+ New Query" to create a new SQL query
5. Copy and paste the contents of the `database/migrations/20240527_create_reactions_table.sql` file into the SQL editor
6. Click "Run" to execute the script

The SQL script will:
- Create a new `reactions` table to store emoji reactions for letters
- Set up appropriate foreign key relationships to the `letters` and `users` tables
- Configure Row Level Security (RLS) policies for the table
- Create a trigger function to generate notifications when a new reaction is added

## Verifying the Migration

After running the migration, you can verify it was successful by:

1. In the Supabase Studio left sidebar, navigate to "Table Editor" 
2. You should see a new `reactions` table in the list
3. Click on the table to view its structure and verify it matches the expected schema

## Troubleshooting

If you encounter any errors when running the migration:

1. Check if the `reactions` table already exists (the script uses `CREATE TABLE IF NOT EXISTS` so this shouldn't be an issue)
2. Ensure you have the proper permissions to create tables and policies in your Supabase project
3. If you see foreign key constraint errors, ensure that the referenced tables (`letters` and `auth.users`) exist and have the referenced columns

If you continue to experience issues, you can:
- Check the Supabase logs in the Dashboard under "Logs" in the left sidebar
- Contact Supabase support or your development team for assistance

## Future Migrations

For any future migrations, follow the same process:
1. Add the SQL migration file to the `database/migrations/` directory
2. Apply the migration manually using the Supabase Studio SQL Editor as described above 