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
 * Checks if there is a blocking relationship between the current user and the specified user
 * This checks BOTH if the current user has blocked the target user OR if the target user has blocked the current user
 * @param userId The ID of the user to check
 * @returns A promise resolving to {isBlocked: boolean, error?: string}
 */
export const isUserBlocked = async (userId: string): Promise<{isBlocked: boolean, error?: string}> => {
  try {
    console.log(`[blockingService] Checking if bidirectional block exists with user: ${userId}`);
    
    // Get the current user
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    
    if (!currentUserId) {
      return { isBlocked: false, error: 'User not authenticated' };
    }
    
    // Check if the current user has blocked the target user
    const { data: blockedByMe, error: error1 } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', userId)
      .maybeSingle();
    
    // Check if the target user has blocked the current user
    const { data: blockedMe, error: error2 } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', currentUserId)
      .maybeSingle();
    
    // Handle errors from either query
    if (error1 && error1.code !== 'PGRST116') {
      console.error('[blockingService] Error checking if I blocked user:', error1);
      return { isBlocked: false, error: error1.message };
    }
    
    if (error2 && error2.code !== 'PGRST116') {
      console.error('[blockingService] Error checking if user blocked me:', error2);
      return { isBlocked: false, error: error2.message };
    }
    
    // If we got a result from either query, there is a blocking relationship
    const isBlocked = !!blockedByMe || !!blockedMe;
    
    if (isBlocked) {
      console.log(`[blockingService] Block relationship found: ${!!blockedByMe ? 'I blocked them' : 'They blocked me'}`);
    }
    
    return { isBlocked };
  } catch (e: any) {
    console.error('[blockingService] Unexpected error checking blocking relationship:', e);
    return { isBlocked: false, error: e.message || 'An unexpected error occurred' };
  }
};

/**
 * Gets a complete list of user IDs involved in blocking relationships with the current user
 * This includes both users blocked BY the current user AND users WHO HAVE blocked the current user
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
    
    // Get users that the current user has blocked
    const { data: blockedByMe, error: error1 } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);
    
    // Get users who have blocked the current user
    const { data: blockedMe, error: error2 } = await supabase
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocked_id', currentUserId);
    
    if (error1) {
      console.error('[blockingService] Error fetching users blocked by me:', error1);
      return { blockedIds: [], error: error1.message };
    }
    
    if (error2) {
      console.error('[blockingService] Error fetching users who blocked me:', error2);
      return { blockedIds: [], error: error2.message };
    }
    
    // Combine both lists and remove duplicates
    const blockedByMeIds = blockedByMe?.map(item => item.blocked_id) || [];
    const blockedMeIds = blockedMe?.map(item => item.blocker_id) || [];
    
    // Use a Set to remove duplicates and convert back to array
    const blockedIds = [...new Set([...blockedByMeIds, ...blockedMeIds])];
    
    console.log(`[blockingService] Found ${blockedByMeIds.length} users blocked by me and ${blockedMeIds.length} users who blocked me`);
    
    return { blockedIds };
  } catch (e: any) {
    console.error('[blockingService] Unexpected error fetching blocked user IDs:', e);
    return { blockedIds: [], error: e.message || 'An unexpected error occurred' };
  }
};
