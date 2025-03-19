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

4. Configure user IDs in the script files (see "Configuring User IDs" section below).

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

### Ollama Integration (Optional)

The scripts can use Ollama to improve category assignment accuracy and rewrite posts. Ollama is a local LLM server that provides AI capabilities. To use Ollama:

1. Install Ollama from https://ollama.ai/
2. Start the Ollama server
3. Pull a model (recommended: `ollama pull llama3`)
4. Edit your `.env` file to enable Ollama features:
```
# For categorization
OLLAMA_ENABLED=true

# For post rewriting
OLLAMA_REWRITE=true

# Common settings
OLLAMA_API_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3
```

#### Ollama Features

1. **Categorization**: When enabled, Ollama will analyze post content to determine the most appropriate category, considering category descriptions from your database.

2. **Post Rewriting**: When enabled, Ollama will rewrite Reddit posts to make them more suitable as personal letters. This includes:
   - Improving flow and structure
   - Removing Reddit-specific language/references
   - Making the content more personal and authentic-sounding
   - Preserving the original meaning and emotions

You can test these features without modifying your `.env` file by using these flags with the test script:
```bash
# Test categorization
python test_reddit_api.py --force-ollama

# Test post rewriting
python test_reddit_api.py --test-rewrite

# Test both features
python test_reddit_api.py --force-ollama --test-rewrite
```

## Usage

### Configuring User IDs (Required)

You must specify user IDs to be used as letter authors:

1. Open the script file(s) you want to run (`populate_from_reddit.py` or `populate_from_multiple_subreddits.py`)
2. Locate the `USER_IDS` array near the top of the file
3. Add your desired user IDs to the array, for example:
```python
USER_IDS = ["123e4567-e89b-12d3-a456-426614174000", "523e4567-e89b-12d3-a456-426614174001"]
```

The scripts will not run if the `USER_IDS` array is empty.

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

### Testing the Reddit API

You can test the Reddit API connection and post processing without saving any data to the database:

```bash
python test_reddit_api.py
```

Command line options:

- `--subreddit`: Subreddit to fetch posts from (default: offmychest)
- `--limit`: Number of posts to fetch (default: 5)
- `--time`: Time filter for Reddit API (hour, day, week, month, year, all) (default: week)
- `--verbose`: Print full post content instead of preview
- `--force-ollama`: Force using Ollama for categorization even if not enabled in .env
- `--test-rewrite`: Test post rewriting with Ollama

Example:

```bash
python test_reddit_api.py --subreddit relationship_advice --limit 3 --verbose
```

## Notes

- The scripts automatically assign categories to the posts based on content analysis
  - If Ollama is enabled, it will use LLM-based categorization for better accuracy
  - If Ollama is not available, it will fall back to keyword-based categorization
- Posts can be rewritten by Ollama to make them more suitable as personal letters
- User IDs for letter authors must be specified in the `USER_IDS` array in the script files
- Display names are generated as fake usernames for all letters
- The content is cleaned to remove URLs and Reddit-specific formatting 