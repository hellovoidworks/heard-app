import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Supabase URL and anon key from your project
// Replace these with your actual Supabase URL and anon key from your project settings
// You can find these in the Supabase dashboard under Project Settings > API
const supabaseUrl = 'https://lrdylsehrfkkrjzicczz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZHlsc2VocmZra3JqemljY3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNjQ4MjcsImV4cCI6MjA1Nzc0MDgyN30.6QB5Yibq_I2QiEUWSZsz7vw0TxOR3O5cQlN5d_Td4wk';

// SecureStore adapter for Supabase auth persistence
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
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