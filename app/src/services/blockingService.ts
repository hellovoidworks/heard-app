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
 * Checks if a user is blocked by the current user OR if the user has blocked the current user
 * @param userId The ID of the user to check
 * @returns A promise resolving to {isBlocked: boolean, error?: string}
 */
export const isUserBlocked = async (userId: string): Promise<{isBlocked: boolean, error?: string}> => {
  try {
    console.log(`[blockingService] Checking if user is blocked (bidirectional): ${userId}`);
    
    // Get the current user
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    
    if (!currentUserId) {
      return { isBlocked: false, error: 'User not authenticated' };
    }
    
    // Check if current user has blocked the other user
    const { data: blockedByMe, error: error1 } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors
    
    // Check if the other user has blocked the current user
    const { data: blockedByThem, error: error2 } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', currentUserId)
      .maybeSingle();
    
    if (error1 && error1.code !== 'PGRST116') {
      console.error('[blockingService] Error checking if user is blocked by me:', error1);
      return { isBlocked: false, error: error1.message };
    }
    
    if (error2 && error2.code !== 'PGRST116') {
      console.error('[blockingService] Error checking if I am blocked by user:', error2);
      return { isBlocked: false, error: error2.message };
    }
    
    // If either query returned a result, there is a blocking relationship
    const isBlocked = !!blockedByMe || !!blockedByThem;
    console.log(`[blockingService] Block status for ${userId}: ${isBlocked} (blockedByMe: ${!!blockedByMe}, blockedByThem: ${!!blockedByThem})`);
    
    return { isBlocked };
  } catch (e: any) {
    console.error('[blockingService] Unexpected error checking if user is blocked:', e);
    return { isBlocked: false, error: e.message || 'An unexpected error occurred' };
  }
};

/**
 * Gets the list of user IDs blocked by the current user AND users who have blocked the current user
 * @returns A promise resolving to {blockedIds: string[], error?: string}
 */
export const getBlockedUserIds = async (): Promise<{blockedIds: string[], error?: string}> => {
  try {
    console.log('[blockingService] Fetching all blocked user IDs (bidirectional)');
    
    // Get the current user
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    
    if (!currentUserId) {
      return { blockedIds: [], error: 'User not authenticated' };
    }
    
    // Use the new database function to get all blocked users in both directions
    const { data: blockedUsers, error } = await supabase
      .rpc('get_blocked_users', {
        p_user_id: currentUserId
      });
    
    if (error) {
      console.error('[blockingService] Error fetching blocked users:', error);
      return { blockedIds: [], error: error.message };
    }
    
    // Extract the blocked_id values
    const blockedIds = blockedUsers?.map((item: { blocked_id: string }) => item.blocked_id) || [];
    
    console.log(`[blockingService] Found ${blockedIds.length} blocked users (bidirectional)`);
    console.log(`[blockingService] Blocked IDs: ${blockedIds.join(', ')}`);
    
    return { blockedIds };
  } catch (e: any) {
    console.error('[blockingService] Unexpected error fetching blocked user IDs:', e);
    return { blockedIds: [], error: e.message || 'An unexpected error occurred' };
  }
};
