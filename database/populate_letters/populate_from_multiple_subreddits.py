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

# Import functions from the main script
from populate_from_reddit import (
    setup_reddit, setup_supabase, get_categories,
    fetch_posts, create_letter_from_post, save_letter,
    get_user_ids, rewrite_post_with_ollama
)

# Load environment variables from .env file
load_dotenv()

# Configuration
DEFAULT_LIMIT = 10  # Default number of posts to fetch per category
DEFAULT_TIME_FILTER = "month"  # Default time filter
# User IDs to use for author_id (override random selection)
USER_IDS = []  # Add your user IDs here, e.g. ["123e4567-e89b-12d3-a456-426614174000", "523e4567-e89b-12d3-a456-426614174001"]
# If USER_IDS is empty, the script will fetch users from the database
# Whether to rewrite posts using Ollama (default: false, override with OLLAMA_REWRITE=true in .env)
OLLAMA_REWRITE = os.getenv("OLLAMA_REWRITE", "false").lower() == "true"

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
    "Financial": [
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
    "Friendship": [
        "friendship",
        "socialskills",
        "MakeNewFriendsHere",
        "FriendshipAdvice",
        "depression_help"
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
    "Reflections": [
        "Showerthoughts",
        "self",
        "Meditation",
        "Mindfulness",
        "philosophy",
        "selfimprovement",
        "GetMotivated"
    ],
    "Intimacy": [
        "sex",
        "sexadvice",
        "deadbedrooms",
        "AskMen",
        "AskWomen",
        "relationship_advice",
        "relationshipproblems"
    ],
    "Spiritual": [
        "religion",
        "spirituality",
        "Christianity",
        "islam",
        "Buddhism",
        "hinduism",
        "meditation",
        "Psychonaut"
    ]
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
        List of dictionaries containing post data
    """
    all_posts = []
    
    # For each category in our database
    for category in categories:
        category_name = category["name"]
        
        if category_name in SUBREDDIT_CATEGORIES:
            subreddits = SUBREDDIT_CATEGORIES[category_name]
            
            # Get posts from random subreddits for this category
            selected_subreddits = random.sample(subreddits, min(3, len(subreddits)))
            
            print(f"\n--- Fetching posts for category '{category_name}' ---")
            for subreddit in selected_subreddits:
                try:
                    # Fetch posts from this subreddit
                    posts = fetch_posts(reddit, subreddit, limit_per_category, time_filter)
                    all_posts.extend(posts)
                except Exception as e:
                    print(f"Error fetching from r/{subreddit}: {e}")
        else:
            print(f"No matching subreddits found for category '{category_name}'")
    
    return all_posts

def get_user_ids(supabase: Client) -> List[str]:
    """Get user IDs from the configuration."""
    if not USER_IDS:
        raise ValueError("USER_IDS array is empty. Please specify at least one user ID in the USER_IDS array at the top of the script.")
    
    print(f"Using {len(USER_IDS)} configured user IDs")
    return USER_IDS

def main():
    """Main function to execute the script."""
    parser = argparse.ArgumentParser(description="Populate letters from multiple Reddit subreddits")
    parser.add_argument("--limit", type=int, default=10, help="Number of posts to fetch per category")
    parser.add_argument("--time", choices=["hour", "day", "week", "month", "year", "all"], 
                       default="month", help="Time filter for Reddit API")
    args = parser.parse_args()
    
    try:
        # Set up clients
        reddit = setup_reddit()
        supabase = setup_supabase()
        
        # Get categories and user IDs
        categories = get_categories(supabase)
        user_ids = get_user_ids(supabase)
        
        print(f"Found {len(categories)} categories and {len(user_ids)} users")
        
        # Fetch posts from multiple subreddits
        posts = fetch_from_all_categories(
            reddit, 
            categories, 
            limit_per_category=args.limit, 
            time_filter=args.time
        )
        
        if not posts:
            print("\nNo valid posts found. Exiting.")
            return
        
        print(f"\nFetched {len(posts)} total posts across all categories")
        
        # Convert posts to letters and save immediately
        successful_saves = 0
        for i, post in enumerate(posts, 1):
            try:
                print(f"\nProcessing post {i}/{len(posts)}: {post['title'][:30]}...")
                letter = create_letter_from_post(post, categories, user_ids)
                
                # Save the letter immediately
                if save_letter(supabase, letter):
                    successful_saves += 1
                
                # Small delay to avoid rate limits
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ Error creating letter from post {post['id']}: {e}")
        
        print(f"\n✅ Successfully saved {successful_saves} out of {len(posts)} letters")
        print("Done!")
    
    except Exception as e:
        print(f"\nAn error occurred: {e}")


if __name__ == "__main__":
    main() 