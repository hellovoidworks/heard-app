import { supabase } from '../services/supabase';
import dataCache from './dataCache';

/**
 * Utility to preload data for tabs while on another screen
 * This helps eliminate loading spinners when switching tabs
 */

/**
 * Preloads correspondence data for the Inbox tab
 * @param userId The current user's ID
 */
export async function preloadCorrespondenceData(userId: string): Promise<void> {
  try {
    console.log(`[TabDataPreloader] Preloading correspondence data for user: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'get_user_correspondences_by_pair',
      { p_user_id: userId }
    );

    if (error) {
      console.error('[TabDataPreloader] Error preloading correspondences:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      // Still cache empty array to avoid loading spinner on empty inbox
      await dataCache.saveToCache(dataCache.CACHE_KEYS.CORRESPONDENCES, []);
      return;
    }

    // Process the data same way CorrespondenceTab does
    type CorrespondencePairResult = {
      letter_id: string;
      other_participant_id: string;
      letter_title: string;
      letter_author_id: string;
      letter_created_at: string;
      category_name: string | null;
      category_color: string | null;
      most_recent_interaction_at: string;
      most_recent_interaction_content: string;
      most_recent_interactor_id: string;
      unread_message_count: number;
      mood_emoji: string | null;
      letter_display_name: string | null;
    };

    const otherParticipantIds = data.map((item: CorrespondencePairResult) => item.other_participant_id)
      .filter((id: string | null): id is string => id !== null);
    const uniqueOtherParticipantIds = [...new Set(otherParticipantIds)];

    let participantNames: { [key: string]: string } = {};
    if (uniqueOtherParticipantIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', uniqueOtherParticipantIds);

      if (!profilesError && profilesData) {
        participantNames = profilesData.reduce((acc: { [key: string]: string }, profile: { id: string; username: string | null }) => {
          acc[profile.id] = profile.username || 'Unknown User';
          return acc;
        }, {} as { [key: string]: string });
      }
    }

    const formattedCorrespondences = data.map((item: CorrespondencePairResult) => ({
      letter_id: item.letter_id,
      other_participant_id: item.other_participant_id,
      other_participant_name: participantNames[item.other_participant_id] || 'User',
      letter_title: item.letter_title,
      letter_author_id: item.letter_author_id,
      letter_display_name: item.letter_display_name,
      most_recent_interaction_at: item.most_recent_interaction_at,
      most_recent_interaction_content: item.most_recent_interaction_content.substring(0, 100) + 
        (item.most_recent_interaction_content.length > 100 ? '...' : ''),
      most_recent_interactor_id: item.most_recent_interactor_id,
      unread_message_count: item.unread_message_count,
      category_name: item.category_name,
      category_color: item.category_color,
      mood_emoji: item.mood_emoji,
    }));

    // Cache the processed data
    await dataCache.saveToCache(dataCache.CACHE_KEYS.CORRESPONDENCES, formattedCorrespondences);
    console.log(`[TabDataPreloader] Successfully preloaded ${formattedCorrespondences.length} correspondences`);
  } catch (error) {
    console.error('[TabDataPreloader] Error in preloadCorrespondenceData:', error);
  }
}

/**
 * Preloads my letters data for the My Mail tab
 * @param userId The current user's ID
 */
export async function preloadMyLettersData(userId: string): Promise<void> {
  try {
    console.log(`[TabDataPreloader] Preloading my letters data for user: ${userId}`);
    
    const { data, error } = await supabase
      .rpc('get_my_letters_with_stats', { user_id: userId });

    if (error) {
      console.error('[TabDataPreloader] Error preloading my letters:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      // Still cache empty array to avoid loading spinner on empty tab
      await dataCache.saveToCache(dataCache.CACHE_KEYS.MY_LETTERS, []);
      return;
    }

    // Process the data same way MyLettersTab does
    const processedLetters = data.map((letter: any) => ({
      id: letter.id,
      title: letter.title,
      content: letter.content,
      created_at: letter.created_at,
      category: letter.category_id ? {
        id: letter.category_id,
        name: letter.category_name,
        color: letter.category_color
      } : null,
      mood_emoji: letter.mood_emoji,
      view_count: parseInt(letter.view_count) || 0,
      reply_count: parseInt(letter.reply_count) || 0,
      reaction_count: parseInt(letter.reaction_count) || 0,
      display_name: letter.display_name,
      has_unread_reactions: letter.has_unread_reactions
    }));

    // Sort letters - unread reactions first, then by creation date (newest first)
    const sortedLetters = [...processedLetters].sort((a, b) => {
      // First sort by unread reactions (true values first)
      if (a.has_unread_reactions && !b.has_unread_reactions) return -1;
      if (!a.has_unread_reactions && b.has_unread_reactions) return 1;
      
      // Then sort by date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Cache the processed data
    await dataCache.saveToCache(dataCache.CACHE_KEYS.MY_LETTERS, sortedLetters);
    console.log(`[TabDataPreloader] Successfully preloaded ${sortedLetters.length} my letters`);
  } catch (error) {
    console.error('[TabDataPreloader] Error in preloadMyLettersData:', error);
  }
}

/**
 * Preloads all mailbox tab data at once
 * @param userId The current user's ID
 * @returns Promise that resolves when all preloading is complete
 */
export async function preloadAllMailboxData(userId: string): Promise<void> {
  if (!userId) {
    console.log('[TabDataPreloader] No user ID provided, skipping preload');
    return;
  }
  
  // Use Promise.all to load both data sets in parallel
  await Promise.all([
    preloadCorrespondenceData(userId),
    preloadMyLettersData(userId)
  ]);
  
  console.log('[TabDataPreloader] All mailbox data preloaded successfully');
}

export default {
  preloadCorrespondenceData,
  preloadMyLettersData,
  preloadAllMailboxData
};
