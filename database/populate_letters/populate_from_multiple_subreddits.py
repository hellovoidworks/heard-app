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

# Import functions from the main script
from populate_from_reddit import (
    setup_reddit, setup_supabase, get_categories,
    fetch_posts, create_letter_from_post, save_letters
)

# Load environment variables from .env file
load_dotenv()

# Configuration
DEFAULT_LIMIT = 10  # Default number of posts to fetch per category
DEFAULT_TIME_FILTER = "month"  # Default time filter
# User IDs to use for author_id (override random selection)
USER_IDS = []  # Add your user IDs here, e.g. ["123e4567-e89b-12d3-a456-426614174000", "523e4567-e89b-12d3-a456-426614174001"]
# If USER_IDS is empty, the script will fetch users from the database

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
    """Fetch all user IDs from the database or use configured ones."""
    # If user IDs are specified in the configuration, use those
    if USER_IDS:
        print(f"Using {len(USER_IDS)} configured user IDs")
        return USER_IDS
    
    # Otherwise fetch from the database
    print("Fetching user IDs from the database")
    response = supabase.table("user_profiles").select("id").execute()
    
    if len(response.data) == 0:
        raise ValueError("No users found in the database")
    
    return [user["id"] for user in response.data]

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
            print(f"\nSaving {len(letters)} letters to the database...")
            save_letters(supabase, letters)
            print("Done!")
        else:
            print("\nNo letters created. Exiting.")
    
    except Exception as e:
        print(f"\nAn error occurred: {e}")


if __name__ == "__main__":
    main() 