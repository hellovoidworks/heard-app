// Random username generator with two-word combinations
// Inspired by memorable and friendly usernames

// Lists of positive/friendly adjectives and nouns
const adjectives = [
  'Amber', 'Azure', 'Bright', 'Calm', 'Clever', 'Coral', 'Crimson', 'Crystal',
  'Dapper', 'Deep', 'Eager', 'Elated', 'Emerald', 'Fancy', 'Gentle', 'Glad',
  'Golden', 'Happy', 'Humble', 'Indigo', 'Jade', 'Jolly', 'Kind', 'Lively',
  'Loyal', 'Lucky', 'Mellow', 'Mighty', 'Noble', 'Olive', 'Opal', 'Peaceful',
  'Plum', 'Proud', 'Purple', 'Quiet', 'Royal', 'Ruby', 'Sage', 'Sapphire',
  'Scarlet', 'Serene', 'Silver', 'Smooth', 'Sunny', 'Swift', 'Teal', 'Tranquil',
  'Violet', 'Vivid', 'Warm', 'Wise', 'Witty', 'Zesty'
];

const nouns = [
  'Aura', 'Beam', 'Bloom', 'Bliss', 'Breeze', 'Brook', 'Charm', 'Cloud',
  'Clover', 'Coral', 'Crest', 'Crown', 'Dawn', 'Dew', 'Dream', 'Echo',
  'Ember', 'Fern', 'Flame', 'Flare', 'Flash', 'Flower', 'Forest', 'Galaxy',
  'Garden', 'Gem', 'Glade', 'Glow', 'Harbor', 'Harmony', 'Haven', 'Heart',
  'Horizon', 'Isle', 'Jewel', 'Joy', 'Leaf', 'Light', 'Lily', 'Lotus',
  'Meadow', 'Mist', 'Moon', 'Mountain', 'Ocean', 'Opal', 'Petal', 'Phoenix',
  'Rain', 'Rainbow', 'River', 'Rose', 'Sky', 'Spark', 'Star', 'Stream',
  'Sun', 'Thunder', 'Tide', 'Wave', 'Willow', 'Wind', 'Wing', 'Wonder'
];

/**
 * Generates a random two-word username
 * @returns A string with two capitalized words joined together (e.g., "SilverWave")
 */
export const generateRandomUsername = (): string => {
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${randomAdjective}${randomNoun}`;
};

/**
 * Checks if a username already exists in the database
 * @param username The username to check
 * @param supabase The Supabase client instance
 * @returns True if the username is unique (doesn't exist), false otherwise
 */
export const isUsernameUnique = async (
  username: string, 
  supabase: any
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('username', username)
    .single();
  
  // If there's an error with code PGRST116, it means no record was found
  // which means the username is unique
  if (error && error.code === 'PGRST116') {
    return true;
  }
  
  // If there's no error, it means a record was found, so the username is not unique
  return false;
};

/**
 * Generates a unique random username by checking against the database
 * @param supabase The Supabase client instance
 * @param maxAttempts Maximum number of attempts to generate a unique username
 * @returns A unique username or null if couldn't generate one within maxAttempts
 */
export const generateUniqueRandomUsername = async (
  supabase: any,
  maxAttempts: number = 10
): Promise<string | null> => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const username = generateRandomUsername();
    const isUnique = await isUsernameUnique(username, supabase);
    
    if (isUnique) {
      return username;
    }
    
    attempts++;
  }
  
  // If we couldn't generate a unique username after maxAttempts,
  // add a random number suffix to make it unique
  const baseUsername = generateRandomUsername();
  const randomSuffix = Math.floor(Math.random() * 1000);
  return `${baseUsername}${randomSuffix}`;
};
