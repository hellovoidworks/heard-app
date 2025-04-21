import tabDataPreloader from './tabDataPreloader';

/**
 * Utility to preload mailbox tab data from detail screens
 * This helps ensure that when users navigate back to mailbox tabs,
 * the data is already cached and ready to display
 */

/**
 * Preloads mailbox tab data in the background
 * @param userId The current user's ID
 */
export function preloadMailboxDataFromDetailScreen(userId: string | undefined): void {
  if (!userId) {
    console.log('[DetailScreenPreloader] No user ID provided, skipping preload');
    return;
  }
  
  // Use setTimeout to avoid blocking the UI thread
  setTimeout(() => {
    console.log('[DetailScreenPreloader] Preloading mailbox data in background');
    tabDataPreloader.preloadAllMailboxData(userId);
  }, 1500); // Short delay to prioritize detail screen content loading
}

export default {
  preloadMailboxDataFromDetailScreen
};
