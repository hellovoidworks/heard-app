#!/usr/bin/env python3
"""
Script to test the Reddit API connection using functions from populate_from_reddit.py.
This script will fetch posts and print their content without saving to the database.
"""

import os
import pprint
import argparse
import json
from dotenv import load_dotenv
from datetime import datetime

# Import functions from the main script
from populate_from_reddit import (
    setup_reddit,
    setup_supabase,
    get_categories,
    fetch_posts,
    clean_content,
    assign_category,
    assign_category_keyword,
    assign_category_with_ollama,
    generate_display_name
)

# Load environment variables from .env file
load_dotenv()

# Fallback mock categories for testing if Supabase connection fails
FALLBACK_CATEGORIES = [
    {"id": "1", "name": "Love", "description": "Posts about relationships, dating, marriage, breakups"},
    {"id": "2", "name": "Financial", "description": "Money matters, jobs, career, debt, finances"},
    {"id": "3", "name": "Family", "description": "Parents, children, siblings, family relationships"},
    {"id": "4", "name": "Friendship", "description": "Friends, social circles, colleagues"},
    {"id": "5", "name": "Vent", "description": "Complaints, frustrations, anger, rants"},
    {"id": "6", "name": "Health", "description": "Physical and mental health, medical issues"},
    {"id": "7", "name": "Reflections", "description": "Self-improvement, thoughts, contemplation"},
    {"id": "8", "name": "Intimacy", "description": "Sex, physical relationships, attraction"},
    {"id": "9", "name": "Spiritual", "description": "Religion, faith, spirituality, belief systems"}
]

def test_reddit_api(subreddit, limit, time_filter, verbose=False, force_ollama=False, use_mock=False):
    """
    Test the Reddit API connection and print fetched posts.
    
    Args:
        subreddit: Subreddit to fetch posts from
        limit: Number of posts to fetch
        time_filter: Time filter for Reddit API (hour, day, week, month, year, all)
        verbose: Whether to print full post content
        force_ollama: Whether to force using Ollama for categorization
        use_mock: Whether to use mock categories instead of fetching from Supabase
    """
    print(f"Testing Reddit API connection...")
    print(f"Fetching {limit} posts from r/{subreddit} for time filter: {time_filter}")
    
    try:
        # Set up Reddit client
        reddit = setup_reddit()
        print("✅ Successfully connected to Reddit API")
        
        # Get categories from Supabase or use mock categories
        categories = FALLBACK_CATEGORIES
        if not use_mock:
            try:
                # Setup Supabase client
                supabase = setup_supabase()
                print("✅ Successfully connected to Supabase")
                
                # Fetch real categories from Supabase
                categories = get_categories(supabase)
                print(f"✅ Fetched {len(categories)} categories from Supabase")
                
                # Display category info
                if verbose:
                    print("\n=== Available Categories ===")
                    for cat in categories:
                        print(f"• {cat['name']}: {cat.get('description', 'No description')}")
                    print("")
                
            except Exception as e:
                print(f"❌ Error connecting to Supabase or fetching categories: {e}")
                print("⚠️ Using fallback mock categories instead")
        else:
            print("ℹ️ Using mock categories as requested")
        
        # Fetch posts
        posts = fetch_posts(reddit, subreddit, limit, time_filter)
        
        if not posts:
            print("❌ No valid posts found. Check subreddit name or time filter.")
            return
        
        print(f"\n✅ Successfully fetched {len(posts)} posts\n")
        
        # Check if Ollama is enabled
        use_ollama = os.getenv("OLLAMA_ENABLED", "false").lower() == "true" or force_ollama
        if use_ollama:
            print("🤖 Ollama categorization is enabled")
        else:
            print("🔍 Using keyword-based categorization")
        
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
            combined_content = post['title'] + " " + cleaned_content
            
            # Compare Ollama vs keyword categorization
            if use_ollama:
                category_id_ollama = assign_category_with_ollama(combined_content, categories)
                category_name_ollama = next((cat["name"] for cat in categories if cat["id"] == category_id_ollama), "Unknown")
                
                category_id_keyword = assign_category_keyword(combined_content, categories)
                category_name_keyword = next((cat["name"] for cat in categories if cat["id"] == category_id_keyword), "Unknown")
                
                print(f"\nAssigned Category (Ollama): {category_name_ollama} (ID: {category_id_ollama})")
                print(f"Assigned Category (Keyword): {category_name_keyword} (ID: {category_id_keyword})")
                
                if category_id_ollama != category_id_keyword:
                    print(f"📊 DIFFERENT CATEGORIZATIONS: Ollama: {category_name_ollama}, Keyword: {category_name_keyword}")
            else:
                category_id = assign_category(combined_content, categories)
                category_name = next((cat["name"] for cat in categories if cat["id"] == category_id), "Unknown")
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
    parser.add_argument("--force-ollama", action="store_true",
                        help="Force using Ollama for categorization even if not enabled in .env")
    parser.add_argument("--use-mock", action="store_true",
                        help="Use mock categories instead of fetching from Supabase")
    
    args = parser.parse_args()
    
    test_reddit_api(args.subreddit, args.limit, args.time, args.verbose, args.force_ollama, args.use_mock)

if __name__ == "__main__":
    main() 