import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Supabase URL and anon key from your project
// Replace these with your actual Supabase URL and anon key from your project settings
// You can find these in the Supabase dashboard under Project Settings > API
const supabaseUrl = 'https://lrdylsehrfkkrjzicczz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZHlsc2VocmZra3JqemljY3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNjQ4MjcsImV4cCI6MjA1Nzc0MDgyN30.6QB5Yibq_I2QiEUWSZsz7vw0TxOR3O5cQlN5d_Td4wk';

// Enhanced SecureStore adapter for Supabase auth persistence
// Handles values larger than 2048 bytes by chunking them
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      // Check if we have chunks
      const numChunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
      
      if (numChunksStr) {
        // We have chunks, need to reassemble
        const numChunks = parseInt(numChunksStr, 10);
        let value = '';
        
        for (let i = 0; i < numChunks; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
          if (chunk) {
            value += chunk;
          } else {
            console.warn(`Missing chunk ${i} for key ${key}`);
          }
        }
        
        return value;
      }
      
      // No chunks, regular retrieval
      return SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error retrieving from SecureStore:', error);
      return null;
    }
  },
  
  setItem: async (key: string, value: string) => {
    try {
      // Check if value is too large (SecureStore has a 2048 byte limit)
      if (value.length > 2000) { // Using 2000 to be safe
        console.log(`Value for ${key} is large (${value.length} bytes), chunking it`);
        
        // Clear any existing chunks
        const existingNumChunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
        if (existingNumChunksStr) {
          const existingNumChunks = parseInt(existingNumChunksStr, 10);
          for (let i = 0; i < existingNumChunks; i++) {
            await SecureStore.deleteItemAsync(`${key}_${i}`);
          }
        }
        
        // Split into chunks of 1900 bytes (to be safe)
        const chunkSize = 1900;
        const numChunks = Math.ceil(value.length / chunkSize);
        
        // Store number of chunks
        await SecureStore.setItemAsync(`${key}_chunks`, numChunks.toString());
        
        // Store each chunk
        for (let i = 0; i < numChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, value.length);
          const chunk = value.substring(start, end);
          await SecureStore.setItemAsync(`${key}_${i}`, chunk);
        }
      } else {
        // Value is small enough, store normally
        await SecureStore.setItemAsync(key, value);
        
        // Clean up any chunks if they exist
        const numChunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
        if (numChunksStr) {
          const numChunks = parseInt(numChunksStr, 10);
          for (let i = 0; i < numChunks; i++) {
            await SecureStore.deleteItemAsync(`${key}_${i}`);
          }
          await SecureStore.deleteItemAsync(`${key}_chunks`);
        }
      }
    } catch (error) {
      console.error('Error storing in SecureStore:', error);
    }
  },
  
  removeItem: async (key: string) => {
    try {
      // Check if we have chunks
      const numChunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
      
      if (numChunksStr) {
        // Delete all chunks
        const numChunks = parseInt(numChunksStr, 10);
        for (let i = 0; i < numChunks; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      
      // Delete the main key
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing from SecureStore:', error);
    }
  },
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Export types
export type { User, Session } from '@supabase/supabase-js'; 