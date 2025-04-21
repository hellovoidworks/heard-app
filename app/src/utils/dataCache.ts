import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  MY_LETTERS: 'cached_my_letters',
  CORRESPONDENCES: 'cached_correspondences',
};

// Maximum age of cache in milliseconds (5 minutes)
const MAX_CACHE_AGE = 5 * 60 * 1000;

export const saveToCache = async (key: string, data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    await AsyncStorage.setItem(`${key}_timestamp`, Date.now().toString());
    console.log(`Data saved to cache: ${key}`);
  } catch (error) {
    console.error(`Error saving to cache (${key}):`, error);
  }
};

export const getFromCache = async <T>(key: string): Promise<{ data: T | null; isFresh: boolean }> => {
  try {
    const cachedData = await AsyncStorage.getItem(key);
    const timestampStr = await AsyncStorage.getItem(`${key}_timestamp`);
    
    if (!cachedData) return { data: null, isFresh: false };
    
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
    const isFresh = Date.now() - timestamp < MAX_CACHE_AGE;
    
    console.log(`Retrieved cache for ${key}, isFresh: ${isFresh}`);
    return { data: JSON.parse(cachedData) as T, isFresh };
  } catch (error) {
    console.error(`Error reading from cache (${key}):`, error);
    return { data: null, isFresh: false };
  }
};

export default {
  CACHE_KEYS,
  saveToCache,
  getFromCache,
};
