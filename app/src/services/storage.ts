import { MMKV } from 'react-native-mmkv';

// Initialize MMKV
export const storage = new MMKV({
  id: 'heard-app-storage',
  encryptionKey: 'heard-app-key' // Basic encryption for stored data
});

// Storage keys
export const STORAGE_KEYS = {
  HOME_LETTERS: 'heard_home_letters',
  LETTER_RECEIVED_TIME: 'heard_letter_received_time'
};

// Helper functions for common operations
export const StorageService = {
  // Get user-specific key
  getUserKey: (userId: string, key: string) => {
    return `user_${userId}_${key}`;
  },

  // Store data with user namespace
  setItem: (key: string, value: any, userId?: string) => {
    try {
      const storageKey = userId ? `user_${userId}_${key}` : key;
      storage.set(storageKey, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error storing data:', error);
      return false;
    }
  },

  // Get data with user namespace
  getItem: (key: string, userId?: string) => {
    try {
      const storageKey = userId ? `user_${userId}_${key}` : key;
      const value = storage.getString(storageKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error retrieving data:', error);
      return null;
    }
  },

  // Remove data with user namespace
  removeItem: (key: string, userId?: string) => {
    try {
      const storageKey = userId ? `user_${userId}_${key}` : key;
      storage.delete(storageKey);
      return true;
    } catch (error) {
      console.error('Error removing data:', error);
      return false;
    }
  },

  // Clear all data for a specific user
  clearUserData: (userId: string) => {
    try {
      // Get all keys
      const allKeys = storage.getAllKeys();
      
      // Filter and delete user-specific keys
      const userPrefix = `user_${userId}_`;
      allKeys.forEach(key => {
        if (key.startsWith(userPrefix)) {
          storage.delete(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Error clearing user storage:', error);
      return false;
    }
  },

  // Clear all data
  clear: () => {
    try {
      storage.clearAll();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }
}; 