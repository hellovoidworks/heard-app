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
import requests

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
# User IDs to use for author_id (override random selection)
USER_IDS = ['fd3c4746-5f3a-45da-bd13-4274740c44a8']  # Add your user IDs here, e.g. ["123e4567-e89b-12d3-a456-426614174000", "523e4567-e89b-12d3-a456-426614174001"]
# If USER_IDS is empty, the script will fetch users from the database
# Whether to rewrite posts using Ollama (default: false, override with OLLAMA_REWRITE=true in .env)
OLLAMA_REWRITE = os.getenv("OLLAMA_REWRITE", "false").lower() == "true"


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


def assign_category_with_ollama(post_content: str, categories: List[Dict[str, Any]]) -> str:
    """
    Use Ollama to assign a category to a post based on content.
    
    Args:
        post_content: The content of the post (title and body)
        categories: List of available categories with name and description
        
    Returns:
        The ID of the assigned category
    """
    # Get the Ollama API URL from environment or use default
    ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    
    # Get the model name from environment or use default
    model = os.getenv("OLLAMA_MODEL", "llama3")
    
    # Create a list of category names with descriptions
    category_desc = []
    for cat in categories:
        desc = cat.get("description", "")
        if desc:
            category_desc.append(f"{cat['name']}: {desc}")
        else:
            category_desc.append(cat['name'])
    
    # Create the prompt
    prompt = f"""
You are tasked with categorizing a post into one of the following categories:

{chr(10).join(category_desc)}

Please analyze the following post and select the most appropriate category.
Only respond with the exact name of ONE category from the list. Do not add any explanation.

POST:
{post_content[:3000]}  # Limit to first 3000 chars to avoid token limits
"""

    try:
        # Send request to Ollama
        response = requests.post(
            ollama_url,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False
            },
            timeout=60  # 60 second timeout (1 minute)
        )
        
        # Check if the request was successful
        if response.status_code == 200:
            result = response.json()
            category_response = result.get("response", "").strip()
            
            # Find the closest match in our category names
            for category in categories:
                if category["name"].lower() == category_response.lower():
                    print(f"Ollama assigned category: {category['name']}")
                    return category["id"]
            
            # If no exact match, try to find a partial match
            for category in categories:
                if category["name"].lower() in category_response.lower():
                    print(f"Ollama assigned category (partial match): {category['name']}")
                    return category["id"]
                    
            # If Ollama response doesn't match any category, log and fall back
            print(f"Ollama response '{category_response}' didn't match any category, falling back to keyword-based assignment")
            return assign_category_keyword(post_content, categories)
        else:
            print(f"Error from Ollama API: {response.status_code} - {response.text}")
            return assign_category_keyword(post_content, categories)
    
    except Exception as e:
        print(f"Error connecting to Ollama: {e}")
        return assign_category_keyword(post_content, categories)


def assign_category_keyword(post_content: str, categories: List[Dict[str, Any]]) -> str:
    """
    Assign a category based on post content and title using keyword matching.
    This is used as a fallback if Ollama is not available.
    """
    # Define keywords for each category
    category_keywords = {
        "Love": ["love", "relationship", "boyfriend", "girlfriend", "dating", "marriage", "crush", "partner", "husband", "wife", "romance", "breakup", "ex"],
        "Financial": ["money", "debt", "finance", "financial", "job", "income", "loan", "budget", "savings", "bills", "rent", "salary", "career", "bank", "tax", "invest"],
        "Family": ["family", "parent", "mother", "father", "dad", "mom", "son", "daughter", "sibling", "brother", "sister", "grandparent", "cousin", "uncle", "aunt", "in-law", "child"],
        "Friendship": ["friend", "friendship", "best friend", "buddy", "pal", "social circle", "acquaintance", "colleague", "betrayal", "trust"],
        "Vent": ["angry", "frustrated", "tired of", "sick of", "annoyed", "irritated", "furious", "fed up", "rant", "vent", "complaint", "venting", "upset", "mad"],
        "Health": ["health", "doctor", "medical", "sick", "illness", "disease", "diagnosis", "pain", "symptom", "weight", "diet", "exercise", "mental health", "therapy", "medication"],
        "Reflections": ["thinking about", "reflect", "wonder", "contemplating", "perspective", "realization", "epiphany", "awakening", "retrospect", "introspection", "growth", "change"],
        "Intimacy": ["sex", "intimate", "physical", "sexual", "attraction", "desire", "bedroom", "consent", "virgin", "pleasure", "passion"],
        "Spiritual": ["god", "faith", "religion", "spiritual", "belief", "prayer", "meditation", "soul", "universe", "divine", "church", "temple", "mosque", "worship"]
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


def assign_category(post_content: str, categories: List[Dict[str, Any]]) -> str:
    """
    Assign a category to a post based on content.
    Tries to use Ollama if available, otherwise falls back to keyword matching.
    
    Args:
        post_content: The content of the post (title and body)
        categories: List of available categories
        
    Returns:
        The ID of the assigned category
    """
    # Check if OLLAMA_ENABLED is set to true in env
    use_ollama = os.getenv("OLLAMA_ENABLED", "false").lower() == "true"
    
    if use_ollama:
        return assign_category_with_ollama(post_content, categories)
    else:
        return assign_category_keyword(post_content, categories)


def generate_display_name(author_name: str) -> str:
    """Generate a fake display name for the letter author."""
    return fake.user_name()


def rewrite_post_with_ollama(title: str, content: str) -> Dict[str, str]:
    """
    Use Ollama to rewrite the post content and title to make it more suitable as a letter.
    
    Args:
        title: The original post title
        content: The cleaned post content
        
    Returns:
        Dict with 'title' and 'content' keys containing the rewritten versions
    """
    # Get the Ollama API URL from environment or use default
    ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
    
    # Get the model name from environment or use default
    model = os.getenv("OLLAMA_MODEL", "llama3")
    
    # Create the prompt for content rewriting
    prompt = f"""
Please rewrite the following post to make it more suitable as a personal letter. 
Maintain the original meaning, emotions, and key points, but improve the structure, flow, and readability.
Remove any Reddit-specific language or references.
Make it personal and authentic-sounding.
Do not add any explanations or comments outside of the letter content.

TITLE: {title}

CONTENT:
{content[:3000]}  # Limit to first 3000 chars to avoid token limits

Respond with a JSON object containing the rewritten title and content in the following format:
{{
  "title": "Rewritten title here",
  "content": "Rewritten content here"
}}
Do not include any other text in your response besides this JSON object.
"""

    try:
        # Send request to Ollama
        response = requests.post(
            ollama_url,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False
            },
            timeout=60  # 60 second timeout (1 minute)
        )
        
        # Check if the request was successful
        if response.status_code == 200:
            result = response.json()
            response_text = result.get("response", "").strip()
            
            # Try to parse the JSON response
            try:
                # Find JSON object in the response
                json_match = re.search(r'({[\s\S]*})', response_text)
                if json_match:
                    json_str = json_match.group(1)
                    rewritten = eval(json_str)  # Using eval since the JSON might not be perfectly formatted
                    
                    # Validate the response has the expected keys
                    if "title" in rewritten and "content" in rewritten:
                        print("✅ Successfully rewrote post with Ollama")
                        return rewritten
                
                # If we couldn't parse the JSON properly, return the original
                print("⚠️ Could not parse Ollama's JSON response, using original content")
                return {"title": title, "content": content}
                
            except Exception as e:
                print(f"⚠️ Error parsing Ollama's response as JSON: {e}")
                return {"title": title, "content": content}
        else:
            print(f"⚠️ Error from Ollama API: {response.status_code} - {response.text}")
            return {"title": title, "content": content}
    
    except Exception as e:
        print(f"⚠️ Error connecting to Ollama for rewriting: {e}")
        return {"title": title, "content": content}


def create_letter_from_post(post: Dict[str, Any], categories: List[Dict[str, Any]], user_ids: List[str]) -> Dict[str, Any]:
    """Convert a Reddit post to a letter format for our database."""
    # Clean the content
    cleaned_content = clean_content(post["content"])
    title = post["title"]
    
    # Rewrite the post if enabled
    if OLLAMA_REWRITE:
        print(f"Rewriting post: {title[:30]}...")
        rewritten = rewrite_post_with_ollama(title, cleaned_content)
        title = rewritten["title"]
        cleaned_content = rewritten["content"]
    
    # Generate display name
    display_name = generate_display_name(post["author"])
    
    # Assign a category based on the final content (original or rewritten)
    category_id = assign_category(title + " " + cleaned_content, categories)
    
    # Select a random user as the author
    author_id = random.choice(user_ids)
    
    # Create letter object
    letter = {
        "id": str(uuid.uuid4()),
        "author_id": author_id,
        "display_name": display_name,
        "title": title,
        "content": cleaned_content,
        "category_id": category_id,
        "created_at": datetime.utcfromtimestamp(post["created_utc"]).isoformat(),
        "updated_at": datetime.utcfromtimestamp(post["created_utc"]).isoformat()
    }
    
    return letter


def get_user_ids(supabase: Client) -> List[str]:
    """Get user IDs from the configuration."""
    if not USER_IDS:
        raise ValueError("USER_IDS array is empty. Please specify at least one user ID in the USER_IDS array at the top of the script.")
    
    print(f"Using {len(USER_IDS)} configured user IDs")
    return USER_IDS


def save_letter(supabase: Client, letter: Dict[str, Any]) -> bool:
    """Save a single letter to the database.
    
    Returns:
        True if successful, False otherwise.
    """
    try:
        response = supabase.table("letters").insert(letter).execute()
        if response.data:
            print(f"✅ Saved letter: {letter['title'][:30]}...")
            return True
        else:
            print(f"❌ Failed to save letter: {letter['title'][:30]}...")
            return False
    except Exception as e:
        print(f"❌ Error saving letter to database: {e}")
        return False


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
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    main() 