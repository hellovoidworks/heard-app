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

# Import functions from the main script
from populate_from_reddit import (
    setup_reddit, setup_supabase, get_categories, get_user_ids,
    fetch_posts, create_letter_from_post, save_letters
)

# Load environment variables from .env file
load_dotenv()

# Default subreddits grouped by matching categories
SUBREDDIT_CATEGORIES = {
    "Personal": [
        "offmychest",
        "confession",
        "CasualConversation",
        "self",
        "stories",
    ],
    "Advice": [
        "advice",
        "relationship_advice",
        "dating_advice",
        "AskReddit",
        "AmItheAsshole",
    ],
    "Gratitude": [
        "gratitude",
        "MadeMeSmile",
        "HumansBeingBros",
        "happy",
        "CongratsLikeImFive",
    ],
    "Reflection": [
        "Showerthoughts",
        "philosophy",
        "DoesAnybodyElse",
        "self",
        "Mindfulness",
    ],
    "Support": [
        "mentalhealth",
        "depression",
        "anxiety",
        "SuicideWatch",
        "kindvoice",
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