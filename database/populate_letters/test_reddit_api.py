#!/usr/bin/env python3
"""
Script to test the Reddit API connection using functions from populate_from_reddit.py.
This script will fetch posts and print their content without saving to the database.
"""

import os
import pprint
import argparse
from dotenv import load_dotenv
from datetime import datetime

# Import functions from the main script
from populate_from_reddit import (
    setup_reddit,
    fetch_posts,
    clean_content,
    assign_category,
    generate_display_name
)

# Load environment variables from .env file
load_dotenv()

# Mock categories for testing assign_category function
MOCK_CATEGORIES = [
    {"id": "1", "name": "Love"},
    {"id": "2", "name": "Financial"},
    {"id": "3", "name": "Family"},
    {"id": "4", "name": "Friendship"},
    {"id": "5", "name": "Vent"},
    {"id": "6", "name": "Health"},
    {"id": "7", "name": "Reflections"},
    {"id": "8", "name": "Intimacy"},
    {"id": "9", "name": "Spiritual"}
]

def test_reddit_api(subreddit, limit, time_filter, verbose=False):
    """
    Test the Reddit API connection and print fetched posts.
    
    Args:
        subreddit: Subreddit to fetch posts from
        limit: Number of posts to fetch
        time_filter: Time filter for Reddit API (hour, day, week, month, year, all)
        verbose: Whether to print full post content
    """
    print(f"Testing Reddit API connection...")
    print(f"Fetching {limit} posts from r/{subreddit} for time filter: {time_filter}")
    
    try:
        # Set up Reddit client
        reddit = setup_reddit()
        print("✅ Successfully connected to Reddit API")
        
        # Fetch posts
        posts = fetch_posts(reddit, subreddit, limit, time_filter)
        
        if not posts:
            print("❌ No valid posts found. Check subreddit name or time filter.")
            return
        
        print(f"\n✅ Successfully fetched {len(posts)} posts\n")
        
        # Print post information and test processing functions
        for i, post in enumerate(posts, 1):
            print(f"\n=== Post {i} ===")
            print(f"Title: {post['title']}")
            print(f"Author: {post['author']}")
            print(f"Created: {datetime.utcfromtimestamp(post['created_utc']).strftime('%Y-%m-%d %H:%M:%S UTC')}")
            
            # Test content cleaning
            cleaned_content = clean_content(post['content'])
            
            if verbose:
                print(f"\nOriginal Content:")
                print(post['content'])
                print(f"\nCleaned Content:")
                print(cleaned_content)
            else:
                content_preview = cleaned_content[:150] + "..." if len(cleaned_content) > 150 else cleaned_content
                print(f"\nCleaned Content Preview: {content_preview}")
            
            # Test category assignment
            category_id = assign_category(post['title'] + " " + cleaned_content, MOCK_CATEGORIES)
            category_name = next((cat["name"] for cat in MOCK_CATEGORIES if cat["id"] == category_id), "Unknown")
            print(f"\nAssigned Category: {category_name} (ID: {category_id})")
            
            # Test display name generation
            display_name = generate_display_name(post['author'])
            print(f"Generated Display Name: {display_name}")
            
            print("\n" + "-" * 80)
            
    except Exception as e:
        print(f"❌ Error testing Reddit API: {e}")
        raise e

def main():
    parser = argparse.ArgumentParser(description="Test Reddit API and post processing functions")
    parser.add_argument("--subreddit", type=str, default="offmychest", 
                        help="Subreddit to fetch posts from (default: offmychest)")
    parser.add_argument("--limit", type=int, default=5, 
                        help="Number of posts to fetch (default: 5)")
    parser.add_argument("--time", choices=["hour", "day", "week", "month", "year", "all"], 
                        default="week", help="Time filter for Reddit API (default: week)")
    parser.add_argument("--verbose", action="store_true", 
                        help="Print full post content instead of preview")
    
    args = parser.parse_args()
    
    test_reddit_api(args.subreddit, args.limit, args.time, args.verbose)

if __name__ == "__main__":
    main() 