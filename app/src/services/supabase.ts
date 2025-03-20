import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Supabase URL and anon key from your project
// Replace these with your actual Supabase URL and anon key from your project settings
// You can find these in the Supabase dashboard under Project Settings > API
const supabaseUrl = 'https://lrdylsehrfkkrjzicczz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZHlsc2VocmZra3JqemljY3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNjQ4MjcsImV4cCI6MjA1Nzc0MDgyN30.6QB5Yibq_I2QiEUWSZsz7vw0TxOR3O5cQlN5d_Td4wk';

// Constants for chunked storage
const CHUNK_SIZE = 1800; // Safely under the 2048 byte limit
const CHUNK_PREFIX = 'SUPABASE_CHUNK_';
const META_KEY_SUFFIX = '_META';

// Enhanced SecureStore adapter with chunking for large values
const ChunkedSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      // First, try to get the metadata
      const metaKey = `${key}${META_KEY_SUFFIX}`;
      const metaValue = await SecureStore.getItemAsync(metaKey);
      
      if (!metaValue) {
        // No metadata means either no value or using the old storage method
        return SecureStore.getItemAsync(key);
      }
      
      // Parse metadata to get chunk info
      const meta = JSON.parse(metaValue);
      const { chunks } = meta;
      
      // Reassemble the chunked value
      let value = '';
      for (let i = 0; i < chunks; i++) {
        const chunkKey = `${CHUNK_PREFIX}${key}_${i}`;
        const chunk = await SecureStore.getItemAsync(chunkKey);
        if (chunk) {
          value += chunk;
        } else {
          console.warn(`Missing chunk ${i} for key ${key}`);
        }
      }
      
      return value;
    } catch (error) {
      console.error('Error retrieving chunked value:', error);
      return null;
    }
  },
  
  setItem: async (key: string, value: string) => {
    try {
      // If the value is small enough, store it directly
      if (value.length < CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        // Clean up any previous chunked data
        await ChunkedSecureStoreAdapter.removeItem(key);
        return;
      }
      
      // Store in chunks
      const chunks = Math.ceil(value.length / CHUNK_SIZE);
      const metaKey = `${key}${META_KEY_SUFFIX}`;
      
      // Store metadata
      await SecureStore.setItemAsync(metaKey, JSON.stringify({ 
        chunks, 
        totalLength: value.length,
        createdAt: new Date().toISOString()
      }));
      
      // Store each chunk
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, value.length);
        const chunk = value.substring(start, end);
        const chunkKey = `${CHUNK_PREFIX}${key}_${i}`;
        await SecureStore.setItemAsync(chunkKey, chunk);
      }
      
      // Remove the original key to avoid confusion
      await SecureStore.deleteItemAsync(key);
      
      console.log(`Successfully stored ${key} in ${chunks} chunks`);
    } catch (error) {
      console.error('Error storing chunked value:', error);
    }
  },
  
  removeItem: async (key: string) => {
    try {
      // First check if this is chunked storage
      const metaKey = `${key}${META_KEY_SUFFIX}`;
      const metaValue = await SecureStore.getItemAsync(metaKey);
      
      if (metaValue) {
        // It's chunked, clean up all chunks
        const { chunks } = JSON.parse(metaValue);
        for (let i = 0; i < chunks; i++) {
          const chunkKey = `${CHUNK_PREFIX}${key}_${i}`;
          await SecureStore.deleteItemAsync(chunkKey);
        }
        // Delete the metadata
        await SecureStore.deleteItemAsync(metaKey);
      }
      
      // Always try to delete the original key
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing chunked value:', error);
    }
  }
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Export types
export type { User, Session } from '@supabase/supabase-js'; 