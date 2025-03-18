#!/usr/bin/env python3
"""
Script to populate the letters table in the Heard app database with content from Reddit.
Fetches top posts from r/offmychest subreddit and creates letters with this content.
"""

import os
import re
import random
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
import praw
from dotenv import load_dotenv
from supabase import create_client, Client
from faker import Faker

# Load environment variables from .env file
load_dotenv()

# Initialize faker for generating display names
fake = Faker()

# Reddit credentials
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "HeardApp/1.0 (by /u/yourUsername)")

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Configuration
SUBREDDIT = "offmychest"  # Subreddit to fetch posts from
LIMIT = 50  # Number of posts to fetch
TIME_FILTER = "month"  # Options: hour, day, week, month, year, all
DISPLAY_NAME_PATTERN = ['Anonymous', '{username}']  # Format for display names


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
        raise ValueError("No categories found in the database")
    
    return response.data


def fetch_posts(reddit: praw.Reddit, subreddit_name: str, limit: int, time_filter: str) -> List[Dict[str, Any]]:
    """Fetch top posts from the specified subreddit."""
    print(f"Fetching top {limit} posts from r/{subreddit_name} for time filter: {time_filter}")
    
    subreddit = reddit.subreddit(subreddit_name)
    posts = []
    
    for post in subreddit.top(time_filter=time_filter, limit=limit):
        # Skip posts that are too short or are removed/deleted
        if (not post.selftext or 
            post.selftext == "[removed]" or 
            post.selftext == "[deleted]" or 
            len(post.selftext) < 20):
            continue
        
        posts.append({
            "id": post.id,
            "title": post.title,
            "content": post.selftext,
            "author": post.author.name if post.author else "deleted",
            "created_utc": post.created_utc
        })
    
    print(f"Fetched {len(posts)} valid posts")
    return posts


def clean_content(content: str) -> str:
    """Clean the post content by removing Reddit-specific formatting and links."""
    # Remove URLs
    content = re.sub(r'https?://\S+', '', content)
    
    # Remove Reddit formatting
    content = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', content)  # Replace [text](link) with just text
    
    # Remove edit notes
    content = re.sub(r'edit(\s*\d*\s*)?:', '', content, flags=re.IGNORECASE)
    content = re.sub(r'update(\s*\d*\s*)?:', '', content, flags=re.IGNORECASE)
    
    # Clean up whitespace
    content = re.sub(r'\n{3,}', '\n\n', content)  # Replace multiple newlines with double newlines
    content = content.strip()
    
    return content


def assign_category(post_content: str, categories: List[Dict[str, Any]]) -> str:
    """
    Assign a category based on post content and title.
    This is a simple implementation that could be improved with NLP.
    """
    # Define keywords for each category
    category_keywords = {
        "Personal": ["my life", "myself", "personal", "experience", "feeling", "story"],
        "Advice": ["advice", "help", "what should", "need guidance", "question"],
        "Gratitude": ["thank", "grateful", "appreciate", "blessed", "lucky"],
        "Reflection": ["thinking about", "reflect", "wonder", "contemplating", "perspective"],
        "Support": ["support", "struggling", "hard time", "difficult", "need help"]
    }
    
    # Convert content to lowercase for easier matching
    content_lower = post_content.lower()
    
    # Try to match based on keywords
    matches = {}
    for category_name, keywords in category_keywords.items():
        score = sum(1 for keyword in keywords if keyword in content_lower)
        matches[category_name] = score
    
    # Find the best match
    best_match = max(matches.items(), key=lambda x: x[1])
    
    # If no good match found, assign randomly
    if best_match[1] == 0:
        return random.choice(categories)["id"]
    
    # Find the category ID for the best match
    for category in categories:
        if category["name"] == best_match[0]:
            return category["id"]
    
    # Fallback to first category if no match found
    return categories[0]["id"]


def generate_display_name(author_name: str) -> str:
    """Generate a display name based on the pattern and author name."""
    pattern = random.choice(DISPLAY_NAME_PATTERN)
    
    if pattern == 'Anonymous':
        return 'Anonymous'
    
    if '{username}' in pattern:
        # Replace username placeholder with the Reddit username or a generated one if deleted
        if author_name == 'deleted':
            author_name = fake.user_name()
        return pattern.replace('{username}', author_name)
    
    return pattern


def create_letter_from_post(post: Dict[str, Any], categories: List[Dict[str, Any]], user_ids: List[str]) -> Dict[str, Any]:
    """Convert a Reddit post to a letter format for our database."""
    # Clean the content
    cleaned_content = clean_content(post["content"])
    
    # Generate display name
    display_name = generate_display_name(post["author"])
    
    # Assign a category
    category_id = assign_category(post["title"] + " " + cleaned_content, categories)
    
    # Select a random user as the author
    author_id = random.choice(user_ids)
    
    # Create letter object
    letter = {
        "id": str(uuid.uuid4()),
        "author_id": author_id,
        "display_name": display_name,
        "title": post["title"],
        "content": cleaned_content,
        "category_id": category_id,
        "created_at": datetime.utcfromtimestamp(post["created_utc"]).isoformat(),
        "updated_at": datetime.utcfromtimestamp(post["created_utc"]).isoformat()
    }
    
    return letter


def get_user_ids(supabase: Client) -> List[str]:
    """Fetch all user IDs from the database."""
    response = supabase.table("user_profiles").select("id").execute()
    
    if len(response.data) == 0:
        raise ValueError("No users found in the database")
    
    return [user["id"] for user in response.data]


def save_letters(supabase: Client, letters: List[Dict[str, Any]]) -> None:
    """Save letters to the database."""
    # Insert in batches to avoid hitting limits
    batch_size = 10
    batches = [letters[i:i + batch_size] for i in range(0, len(letters), batch_size)]
    
    total_inserted = 0
    for batch in batches:
        response = supabase.table("letters").insert(batch).execute()
        if response.data:
            total_inserted += len(response.data)
        
        # Sleep to avoid rate limits
        time.sleep(1)
    
    print(f"Successfully inserted {total_inserted} letters")


def main():
    """Main function to execute the script."""
    try:
        # Set up clients
        reddit = setup_reddit()
        supabase = setup_supabase()
        
        # Get categories and user IDs
        categories = get_categories(supabase)
        user_ids = get_user_ids(supabase)
        
        print(f"Found {len(categories)} categories and {len(user_ids)} users")
        
        # Fetch posts
        posts = fetch_posts(reddit, SUBREDDIT, LIMIT, TIME_FILTER)
        
        if not posts:
            print("No valid posts found. Exiting.")
            return
        
        # Convert posts to letters
        letters = []
        for post in posts:
            try:
                letter = create_letter_from_post(post, categories, user_ids)
                letters.append(letter)
                print(f"Created letter: {letter['title'][:30]}...")
            except Exception as e:
                print(f"Error creating letter from post {post['id']}: {e}")
        
        # Save letters to the database
        if letters:
            print(f"Saving {len(letters)} letters to the database...")
            save_letters(supabase, letters)
            print("Done!")
        else:
            print("No letters created. Exiting.")
    
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    main() 