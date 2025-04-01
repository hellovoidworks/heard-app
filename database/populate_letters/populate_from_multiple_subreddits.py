#!/usr/bin/env python3
"""
Script to populate the letters table in the Heard app database with content from multiple Reddit subreddits.
This provides a more diverse set of letters covering different categories.
"""

import os
import random
from typing import List, Dict, Any
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client
import time
import re # Added for emoji extraction
import ollama # Added for Ollama integration
import praw
import uuid
from datetime import datetime
import requests

# Load environment variables from .env file
load_dotenv()

# Configuration
DEFAULT_LIMIT = 1000  # Total posts to aim for across all categories
DEFAULT_POSTS_PER_SUBREDDIT = 100  # Number of posts to fetch per subreddit
DEFAULT_TIME_FILTER = "month"  # Default time filter
# User IDs to use for author_id (override random selection)
USER_IDS = ['fd3c4746-5f3a-45da-bd13-4274740c44a8']  # Add your user IDs here, e.g. ["123e4567-e89b-12d3-a456-426614174000", "523e4567-e89b-12d3-a456-426614174001"]
# If USER_IDS is empty, the script will fetch users from the database

# --- Ollama Integration ---
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:instruct") # Or choose your preferred model
ALLOWED_EMOJIS = ['😌', '🤗', '👌', '💗', '😁', '🥱', '😪', '😕', '😖', '😈', '😟', '😴', '😢', '🫥', '💔', '😩', '😡', '🫨', '😨', '🫠']
DEFAULT_EMOJI = '😌' # Fallback emoji
DEFAULT_DISPLAY_NAME = "Anon" # Fallback display name

def is_ollama_running() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        # Try a simple ping to Ollama
        response = ollama.list()
        return True
    except Exception as e:
        print(f"❌ Ollama is not running or accessible: {e}")
        return False

def ollama_rewrite_post(text: str) -> str:
    """Rewrites the post content using Ollama to be under 200 words."""
    if not is_ollama_running():
        print("⚠️ Ollama is not running. Using original text.")
        return text
        
    prompt = f"Rewrite the following text to be engaging and concise, keeping it under 200 words. Do not add any introductory or concluding phrases like 'Here\'s the rewritten text:'. Just provide the rewritten text directly:\n\n{text}"
    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=[{'role': 'user', 'content': prompt}])
        rewritten_text = response['message']['content'].strip()
        print("📝 Ollama rewrite successful.")
        return rewritten_text
    except Exception as e:
        print(f"❌ Ollama rewrite error: {e}. Using original text.")
        return text # Fallback to original text

def ollama_get_emoji(text: str) -> str:
    """Gets a mood emoji from the allowed list using Ollama."""
    if not is_ollama_running():
        print("⚠️ Ollama is not running. Using default emoji.")
        return DEFAULT_EMOJI
        
    emoji_list_str = " ".join(ALLOWED_EMOJIS)
    prompt = f"Analyze the sentiment and core emotion of the following text. Based on that, choose the *single* most appropriate emoji from this list: {emoji_list_str}. Only output the single chosen emoji and nothing else.\n\nText:\n{text}"
    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=[{'role': 'user', 'content': prompt}])
        result = response['message']['content'].strip()
        # Extract the first emoji found in the response
        emojis_found = re.findall(r'[\U0001F300-\U0001FAFF]', result) # Basic unicode range for emojis
        if emojis_found and emojis_found[0] in ALLOWED_EMOJIS:
            print(f"😊 Ollama chose emoji: {emojis_found[0]}")
            return emojis_found[0]
        else:
            random_emoji = random.choice(ALLOWED_EMOJIS)
            print(f"⚠️ Ollama emoji response invalid ('{result}') or not in allowed list. Using random emoji: {random_emoji}")
            return random_emoji
    except Exception as e:
        random_emoji = random.choice(ALLOWED_EMOJIS)
        print(f"❌ Ollama emoji error: {e}. Using random emoji: {random_emoji}")
        return random_emoji

def ollama_get_display_name(text: str) -> str:
    """Generates a short, anonymous-style display name using Ollama based on the text."""
    if not is_ollama_running():
        print("⚠️ Ollama is not running. Using default display name.")
        return DEFAULT_DISPLAY_NAME
        
    prompt = f"Based on the content of the following text, generate a short (1-3 words), creative, and anonymous-sounding author display name. Examples: WanderingSoul, QuietObserver, JustSharing, NightThinker, SeekingLight. Do not use generic names like 'Anon' or 'User'. The name should NOT contain spaces. Output only the display name and nothing else.\n\nText:\n{text}"
    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=[{'role': 'user', 'content': prompt}])
        name = response['message']['content'].strip().lower() # Make lowercase
        # Remove any spaces
        name = name.replace(" ", "")
        # Basic validation
        if len(name) < 30:
             print(f"👤 Ollama generated display name: {name}")
             return name
        else:
             print(f"⚠️ Ollama display name response invalid ('{name}'). Using default.")
             return DEFAULT_DISPLAY_NAME.lower()

    except Exception as e:
        print(f"❌ Ollama display name error: {e}. Using default name.")
        return DEFAULT_DISPLAY_NAME.lower()
# --- End Ollama Integration ---

# --- Start: Functions from populate_from_reddit.py ---

# Reddit credentials
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "HeardApp/1.0 (by /u/yourUsername)")

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# List of keywords that will cause a post to be skipped if they appear in the content
SKIP_KEYWORDS = [
    "suicide", "kill myself", "killing myself",
    "self harm", "cutting myself",
    "rape", "molest", "assault",
    "abuse", "domestic violence",
    "genocide", "terrorist", "terrorism"
]

def setup_reddit() -> praw.Reddit:
    """Initialize and return a Reddit API client."""
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        raise ValueError("Reddit credentials are not properly configured in the .env file")
    
    return praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT
    )


def setup_supabase() -> Client:
    """Initialize and return a Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials are not properly configured in the .env file")
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_categories(supabase: Client) -> List[Dict[str, Any]]:
    """Fetch all categories from the database."""
    response = supabase.table("categories").select("*").execute()
    
    if len(response.data) == 0:
        print("⚠️ No categories found in the database. Letters will not have category assigned.")
        return []  # Return empty list instead of raising error
    
    print(f"Found {len(response.data)} categories in the database.")
    return response.data


def fetch_posts(reddit: praw.Reddit, subreddit_name: str, limit: int, time_filter: str) -> List[Dict[str, Any]]:
    """Fetch top posts from the specified subreddit."""
    print(f"Fetching top {limit} posts from r/{subreddit_name} for time filter: {time_filter}")
    
    subreddit = reddit.subreddit(subreddit_name)
    posts = []
    
    try:
        for post in subreddit.top(time_filter=time_filter, limit=limit):
            # Skip posts that are too short or are removed/deleted or not selfposts
            if (not post.is_self or  # Ensure it's a text post
                not post.selftext or 
                post.selftext == "[removed]" or 
                post.selftext == "[deleted]" or 
                len(post.selftext) < 50):  # Increased min length slightly
                continue
            
            posts.append({
                "id": post.id,
                "title": post.title,
                "content": post.selftext,  # Use 'content' key
                "author": post.author.name if post.author else "deleted",
                "created_utc": post.created_utc,
                "url": f"https://www.reddit.com{post.permalink}",  # Add the full URL
                "subreddit": subreddit_name  # Add the subreddit name
            })
    except praw.exceptions.PRAWException as e:
        print(f"❌ PRAW error fetching from r/{subreddit_name}: {e}")
    except Exception as e:
        print(f"❌ Unexpected error fetching from r/{subreddit_name}: {e}")
    
    print(f"Fetched {len(posts)} valid posts")
    return posts


def contains_skip_keywords(text: str) -> bool:
    """Check if the text contains any of the keywords that should be skipped."""
    # Check each keyword
    for keyword in SKIP_KEYWORDS:
        if keyword.lower() in text.lower():
            print(f"⚠️ Skipping post containing keyword: '{keyword}'")
            return True
    
    return False


def save_letter(supabase: Client, letter: Dict[str, Any]) -> bool:
    """Save a single letter to the database.
    
    Returns:
        True if successful, False otherwise.
    """
    try:
        response = supabase.table("letters").insert(letter).execute()
        if response.data and len(response.data) > 0:
            print(f"✅ Saved letter: {letter['title'][:30]}...")
            return True
        else:
            print(f"⚠️ Letter insert for '{letter['title'][:30]}...' completed but returned no data. Check DB.")
            if not response.data:
                print(f"❌ Failed to save letter (no data returned): {letter['title'][:30]}...")
                return False
            return True  # If response.data is not empty
    except Exception as e:
        print(f"❌ Error saving letter to database: {e}")
        return False

# --- End: Functions from populate_from_reddit.py ---


# Default subreddits grouped by matching categories
SUBREDDIT_CATEGORIES = {
    "Love": [
        "relationship_advice",
        "dating",
        "dating_advice",
        "love",
        "Marriage",
        "BreakUps",
        "LongDistance"
    ],
    "Money": [ # Renamed from Financial
        "personalfinance",
        "povertyfinance",
        "jobs",
        "careerguidance",
        "financialindependence",
        "frugal",
        "studentloans"
    ],
    "Family": [
        "parenting",
        "family",
        "raisedbynarcissists",
        "JUSTNOFAMILY",
        "JUSTNOMIL",
        "daddit",
        "Mommit"
    ],
    "Friends": [ # Renamed from Friendship
        "friendship",
        "socialskills",
        "MakeNewFriendsHere",
        "FriendshipAdvice",
        "depression_help" # Consider if this still fits or belongs elsewhere
    ],
    "Vent": [
        "offmychest",
        "rant",
        "TrueOffMyChest",
        "venting",
        "Anger",
        "complaints"
    ],
    "Health": [
        "HealthAnxiety",
        "ChronicPain",
        "ChronicIllness",
        "mentalhealth",
        "depression",
        "anxiety",
        "AskDocs"
    ],
    "Life": [ # Renamed from Reflections
        "Showerthoughts",
        "self",
        "Meditation",
        "Mindfulness",
        "philosophy",
        "selfimprovement",
        "GetMotivated"
    ],
    "Spicy": [ # Renamed from Intimacy
        "sex",
        "sexadvice",
        "deadbedrooms",
        "AskMen",
        "AskWomen"
        # "relationship_advice", # Duplicate from Love, removed
        # "relationshipproblems" # Duplicate from Love, removed
    ],
    "Confess": [ # Added new category
        "confessions",
        "TrueOffMyChest", # Borrowed from Vent
        "offmychest", # Borrowed from Vent
        "confession"
    ],
    "Good Vibes": [ # Added new category
        "MadeMeSmile",
        "UpliftingNews",
        "happy",
        "CongratsLikeImFive",
        "toastme",
        "GetMotivated" # Borrowed from Life
    ]
    # Removed Spiritual category
}

def fetch_from_all_categories(reddit, categories, limit_per_category=10, time_filter="month"):
    """
    Fetch posts from subreddits that match each category.

    Args:
        reddit: Reddit API client
        categories: List of category dictionaries from the database
        limit_per_category: Number of posts to fetch per category
        time_filter: Time filter for Reddit API (hour, day, week, month, year, all)

    Returns:
        List of dictionaries containing post data including the category name.
    """
    all_posts = []
    category_map = {cat['name']: cat['id'] for cat in categories} # Map name to ID

    # Build reverse map: subreddit -> category_name
    subreddit_to_category = {}
    for cat_name, subs in SUBREDDIT_CATEGORIES.items():
        if cat_name in category_map: # Only consider categories present in the database
            for sub in subs:
                subreddit_to_category[sub.lower()] = cat_name
        else:
             print(f"⚠️ Category '{cat_name}' defined in script but not found in database categories. Skipping.")


    # For each category in our database
    for category in categories:
        category_name = category["name"]

        if category_name in SUBREDDIT_CATEGORIES:
            subreddits = SUBREDDIT_CATEGORIES[category_name]

            # Get posts from random subreddits for this category
            # Ensure we fetch enough posts across selected subreddits to meet the limit
            selected_subreddits = random.sample(subreddits, min(3, len(subreddits)))
            limit_per_sub = (limit_per_category // len(selected_subreddits)) + 1 # Distribute limit

            print(f"\n--- Fetching posts for category '{category_name}' from {selected_subreddits} ---")
            for subreddit in selected_subreddits:
                try:
                    # Fetch posts from this subreddit
                    posts = fetch_posts(reddit, subreddit, limit_per_sub, time_filter)
                    # Add category name to each post for later use
                    for post in posts:
                        post['category_name'] = category_name
                    all_posts.extend(posts)
                except Exception as e:
                    print(f"Error fetching from r/{subreddit}: {e}")
        else:
            print(f"No matching subreddits found for category '{category_name}'")

    # Deduplicate posts based on ID
    unique_posts = {post['id']: post for post in all_posts}.values()
    print(f"\nFetched {len(unique_posts)} unique posts across categories.")
    return list(unique_posts)


def get_user_ids(supabase: Client) -> List[str]:
    """Get user IDs from the configuration or fallback if needed."""
    if USER_IDS:
        print(f"Using {len(USER_IDS)} configured user IDs")
        return USER_IDS
    else:
        # Fallback: Fetch a few user IDs from the database if USER_IDS is empty
        # This part might need adjustment based on your actual user table/logic
        print("USER_IDS array is empty. Fetching a sample of user IDs from the database.")
        try:
            response = supabase.table('profiles').select('id', count='exact').limit(10).execute()
            if response.data:
                ids = [user['id'] for user in response.data]
                print(f"Fetched {len(ids)} user IDs from DB.")
                if not ids:
                    raise ValueError("No user IDs found in the database profiles table.")
                return ids
            else:
                 raise ValueError("Failed to fetch user IDs from the database.")
        except Exception as e:
             print(f"Error fetching user IDs from DB: {e}")
             raise ValueError("Could not obtain user IDs. Please configure USER_IDS or ensure the profiles table has users.")


def main():
    """Main function to execute the script."""
    parser = argparse.ArgumentParser(description="Populate letters from multiple Reddit subreddits")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Total number of posts to aim for across all categories")
    parser.add_argument("--posts-per-subreddit", type=int, default=DEFAULT_POSTS_PER_SUBREDDIT, 
                      help="Number of posts to fetch from each subreddit")
    parser.add_argument("--time", choices=["hour", "day", "week", "month", "year", "all"],
                       default=DEFAULT_TIME_FILTER, help="Time filter for Reddit API")
    args = parser.parse_args()

    try:
        # Set up clients
        reddit = setup_reddit()
        supabase = setup_supabase()

        # Get categories and user IDs
        categories = get_categories(supabase) # Fetches list of {'id': uuid, 'name': str}
        user_ids = get_user_ids(supabase) # Uses configured or fetched IDs

        if not categories:
            print("❌ No categories found in the database. Exiting.")
            return
        if not user_ids:
             print("❌ No user IDs available. Exiting.")
             return

        category_name_to_id = {cat['name']: cat['id'] for cat in categories}

        # Fetch posts from multiple subreddits based on categories
        # Use the posts_per_subreddit parameter to determine how many posts to fetch from each subreddit
        posts = fetch_from_all_categories(
            reddit,
            categories,
            limit_per_category=args.posts_per_subreddit,
            time_filter=args.time
        )

        if not posts:
            print("\nNo valid posts found. Exiting.")
            return

        print(f"\nFetched {len(posts)} total posts to process.")

        # Process posts: rewrite, get emoji/name, create letter dict, save
        successful_saves = 0
        skipped_posts = 0
        for i, post in enumerate(posts, 1):
            print(f"--- Processing post {i}/{len(posts)} (ID: {post['id']}) ---")
            original_title = post['title']
            original_text = post['content']  # Changed from 'text' to 'content'
            post_url = post.get('url', '')  # Use get with default in case url is missing
            original_subreddit = post.get('subreddit', 'unknown')
            category_name = post.get('category_name', None)

            # Skip if keywords found - combine title and content for checking
            combined_text = original_title + " " + original_text
            if contains_skip_keywords(combined_text):
                 print(f"⚠️ Skipping post due to keywords: {original_title[:50]}...")
                 skipped_posts += 1
                 continue
                 
            # Skip if the post mentions Reddit
            if "reddit" in combined_text.lower():
                 print(f"⚠️ Skipping post that mentions Reddit: {original_title[:50]}...")
                 skipped_posts += 1
                 continue

            # Skip if category not found (shouldn't happen with current logic, but good check)
            if not category_name or category_name not in category_name_to_id:
                print(f"⚠️ Skipping post - could not map subreddit '{original_subreddit}' to a DB category.")
                skipped_posts += 1
                continue

            try:
                # Use Ollama to enhance
                print(f"Original Text ({len(original_text.split())} words): {original_text[:100]}...")
                
                # Process with Ollama - use different prompt for short posts
                if len(original_text.split()) < 20:
                    print(f"⚠️ Text is short ({len(original_text.split())} words). Will expand it.")
                    # For very short posts, use a different prompt to expand them
                    prompt = f"Expand the following short text into an engaging letter or post of about 100-150 words. Be creative but maintain the original sentiment and theme:\n\n{original_text}"
                    try:
                        if is_ollama_running():
                            response = ollama.chat(model=OLLAMA_MODEL, messages=[{'role': 'user', 'content': prompt}])
                            rewritten_content = response['message']['content'].strip()
                            print("📝 Ollama expansion successful.")
                        else:
                            print("⚠️ Ollama is not running. Using original text.")
                            rewritten_content = original_text
                    except Exception as e:
                        print(f"❌ Ollama expansion error: {e}. Using original text.")
                        rewritten_content = original_text
                else:
                    # Normal rewriting for longer posts
                    rewritten_content = ollama_rewrite_post(original_text)
                mood_emoji = ollama_get_emoji(rewritten_content) # Use rewritten content for emoji
                display_name = ollama_get_display_name(rewritten_content) # Use rewritten content for name

                # Construct the letter object
                letter = {
                    "title": original_title,
                    "content": rewritten_content,
                    "category_id": category_name_to_id[category_name],
                    "author_id": random.choice(user_ids),
                    "mood_emoji": mood_emoji,
                    "display_name": display_name
                    # Removed fields that don't exist in the database:
                    # - source_url
                    # - source_type
                    # - original_content
                    # - sentiment_score
                }

                # Save the letter immediately
                if save_letter(supabase, letter):
                    successful_saves += 1
                else:
                    # save_letter function should print errors
                    pass

                # Small delay to avoid rate limits (Reddit and potentially Ollama if remote)
                time.sleep(1) # Increased delay slightly for Ollama calls

            except KeyError as e:
                print(f"❌ KeyError processing post {post['id']}: Missing key {e}")
                print(f"Available keys: {list(post.keys())}")
            except Exception as e:
                print(f"❌ Error processing post {post['id']} ('{original_title[:30]}...'): {e}")
                import traceback
                traceback.print_exc()


        print(f"\n--- Summary ---")
        print(f"Processed {len(posts)} posts.")
        print(f"Skipped {skipped_posts} posts.")
        print(f"✅ Successfully saved {successful_saves} letters.")
        print(f"❌ Failed or errored on {len(posts) - successful_saves - skipped_posts} posts.")
        print("Done!")

    except Exception as e:
        print(f"\n❌ An unexpected error occurred in main: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()