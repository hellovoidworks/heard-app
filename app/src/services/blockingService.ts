import { supabase } from './supabase';
import { StorageService, STORAGE_KEYS } from './storage';
import { LetterWithDetails } from '../types/database.types';
import eventEmitter, { EVENTS } from '../utils/eventEmitter';

/**
 * Removes letters from a blocked user from the cache
 * @param blockedUserId The ID of the blocked user
 * @param currentUserId The ID of the current user
 */
export const removeBlockedUserLettersFromCache = async (blockedUserId: string, currentUserId: string): Promise<void> => {
  try {
    console.log(`[blockingService] Removing cached letters from blocked user: ${blockedUserId}`);
    
    // Get cached letters
    const cachedLetters = StorageService.getItem(STORAGE_KEYS.HOME_LETTERS, currentUserId) as LetterWithDetails[] | null;
    
    if (!cachedLetters || cachedLetters.length === 0) {
      console.log('[blockingService] No cached letters found');
      return;
    }
    
    // Filter out letters from the blocked user
    const filteredLetters = cachedLetters.filter(letter => letter.author_id !== blockedUserId);
    
    if (filteredLetters.length === cachedLetters.length) {
      console.log('[blockingService] No letters from blocked user found in cache');
      return;
    }
    
    // Update the cached letters
    console.log(`[blockingService] Removing ${cachedLetters.length - filteredLetters.length} letters from blocked user in cache`);
    StorageService.setItem(STORAGE_KEYS.HOME_LETTERS, filteredLetters, currentUserId);
  } catch (e: any) {
    console.error('[blockingService] Error removing blocked user letters from cache:', e);
  }
};

/**
 * Blocks a user by their ID
 * @param userId The ID of the user to block
 * @returns A promise resolving to {success: boolean, error?: string}
 */
export const blockUser = async (userId: string): Promise<{success: boolean, error?: string}> => {
  try {
    console.log(`[blockingService] Attempting to block user: ${userId}`);
    
    // Get the current user
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    
    if (!currentUserId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const { data, error } = await supabase.rpc('block_user', {
      p_blocked_id: userId
    });
    
    if (error) {
      console.error('[blockingService] Error blocking user:', error);
      return { success: false, error: error.message };
    }
    
    // The function returns a boolean indicating success
    if (data === true) {
      console.log(`[blockingService] Successfully blocked user: ${userId}`);
      
      // Remove any cached letters from the blocked user
      await removeBlockedUserLettersFromCache(userId, currentUserId);
      
      // Emit an event to notify components (especially HomeScreen) that a user was blocked
      // This will trigger a refresh of the UI to remove any blocked content
      console.log('[blockingService] Emitting USER_BLOCKED event');
      eventEmitter.emit(EVENTS.USER_BLOCKED, userId);
      
      return { success: true };
    } else {
      console.error('[blockingService] Failed to block user, function returned false');
      return { success: false, error: 'Failed to block user' };
    }
  } catch (e: any) {
    console.error('[blockingService] Unexpected error blocking user:', e);
    return { success: false, error: e.message || 'An unexpected error occurred' };
  }
};

/**
 * Checks if a user is blocked by the current user
 * @param userId The ID of the user to check
 * @returns A promise resolving to {isBlocked: boolean, error?: string}
 */
export const isUserBlocked = async (userId: string): Promise<{isBlocked: boolean, error?: string}> => {
  try {
    console.log(`[blockingService] Checking if user is blocked: ${userId}`);
    
    // Get the current user
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    
    if (!currentUserId) {
      return { isBlocked: false, error: 'User not authenticated' };
    }
    
    // Query the user_blocks table directly using RLS
    const { data, error } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId)
      .single();
    
    if (error) {
      // If the error is that no rows were found (PGRST116), the user is not blocked
      if (error.code === 'PGRST116') {
        return { isBlocked: false };
      }
      
      console.error('[blockingService] Error checking if user is blocked:', error);
      return { isBlocked: false, error: error.message };
    }
    
    // If we got a result, the user is blocked
    return { isBlocked: true };
  } catch (e: any) {
    console.error('[blockingService] Unexpected error checking if user is blocked:', e);
    return { isBlocked: false, error: e.message || 'An unexpected error occurred' };
  }
};

/**
 * Gets the list of user IDs blocked by the current user
 * @returns A promise resolving to {blockedIds: string[], error?: string}
 */
export const getBlockedUserIds = async (): Promise<{blockedIds: string[], error?: string}> => {
  try {
    console.log('[blockingService] Fetching blocked user IDs');
    
    // Get the current user
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    
    if (!currentUserId) {
      return { blockedIds: [], error: 'User not authenticated' };
    }
    
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);
    
    if (error) {
      console.error('[blockingService] Error fetching blocked user IDs:', error);
      return { blockedIds: [], error: error.message };
    }
    
    const blockedIds = data?.map(item => item.blocked_id) || [];
    return { blockedIds };
  } catch (e: any) {
    console.error('[blockingService] Unexpected error fetching blocked user IDs:', e);
    return { blockedIds: [], error: e.message || 'An unexpected error occurred' };
  }
};
