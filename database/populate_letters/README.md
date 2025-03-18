# Database Population Scripts

This directory contains scripts to populate the letters table in the database with content from Reddit.

## Categories

The scripts are configured to work with the following categories:

- **Love**: Relationships, dating, marriage, breakups
- **Financial**: Money, jobs, career, debt, finances
- **Family**: Parents, children, siblings, family relationships
- **Friendship**: Friends, social circles, colleagues
- **Vent**: Complaints, frustrations, anger, rants
- **Health**: Physical and mental health, medical issues
- **Reflections**: Self-improvement, thoughts, contemplation
- **Intimacy**: Sex, physical relationships, attraction
- **Spiritual**: Religion, faith, spirituality, belief systems

The scripts will automatically classify Reddit posts into these categories based on content analysis.

## Setup

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

3. Edit the `.env` file with your Reddit API credentials and Supabase credentials.

### Reddit API Credentials

To obtain Reddit API credentials:

1. Go to https://www.reddit.com/prefs/apps
2. Click "Create App" or "Create Another App" at the bottom
3. Fill in the details:
   - Name: HeardApp
   - App type: script
   - Description: App to fetch Reddit content for Heard App
   - About URL: (leave blank)
   - Redirect URI: http://localhost:8000
4. Click "Create app"
5. The client ID is the string under the app name
6. The client secret is the "secret" field

### Supabase Credentials

To obtain Supabase credentials:

1. Go to your Supabase project dashboard
2. Click on the "Settings" gear icon
3. Click on "API"
4. Copy the "URL" and "anon public" key to your `.env` file

## Usage

### Configuring User IDs

By default, the scripts randomly select user IDs from your database to assign as authors of the letters. If you want to use specific user IDs instead:

1. Open the script file(s) you want to run (`populate_from_reddit.py` or `populate_from_multiple_subreddits.py`)
2. Locate the `USER_IDS` array near the top of the file
3. Add your desired user IDs to the array, for example:
```python
USER_IDS = ["123e4567-e89b-12d3-a456-426614174000", "523e4567-e89b-12d3-a456-426614174001"]
```

If the `USER_IDS` array is left empty, the script will fetch user IDs from your database.

### Populate from a single subreddit

This script fetches posts from the r/offmychest subreddit by default:

```bash
python populate_from_reddit.py
```

### Populate from multiple subreddits

This script fetches posts from multiple subreddits across different categories:

```bash
python populate_from_multiple_subreddits.py
```

Command line options:

- `--limit`: Number of posts to fetch per category (default: 10)
- `--time`: Time filter for Reddit API (hour, day, week, month, year, all) (default: month)

Example:

```bash
python populate_from_multiple_subreddits.py --limit 20 --time week
```

## Notes

- The scripts automatically assign categories to the posts based on content analysis
- User IDs for letter authors are either specified in the `USER_IDS` array or randomly selected from existing users in the database
- Display names are generated as fake usernames for all letters
- The content is cleaned to remove URLs and Reddit-specific formatting 