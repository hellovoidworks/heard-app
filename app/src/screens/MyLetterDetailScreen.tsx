import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedEmoji from '../components/AnimatedEmoji';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, SafeAreaView, FlatList } from 'react-native';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, useTheme, Divider } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { LetterWithDetails, ReplyWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dataCache from '../utils/dataCache';
import LetterTitleCard from '../components/LetterTitleCard';
import ReactionDisplay from '../components/ReactionDisplay';
import detailScreenPreloader from '../utils/detailScreenPreloader';
import { getBlockedUserIds } from '../services/blockingService';

type Props = NativeStackScreenProps<RootStackParamList, 'MyLetterDetail'>;

interface Thread {
  id: string;
  replierId: string;
  latestReplyDate: string;
  latestReplyContent: string;
  replyCount: number;
  replierName: string;
  latestReplyAuthorId: string;
};

const MyLetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId, letterData, initialStats, presentationMode } = route.params;
  const isModal = presentationMode === 'modal';
  const [letter, setLetter] = useState<LetterWithDetails | null>(letterData ? letterData as LetterWithDetails : null);
  const [loading, setLoading] = useState(!letterData);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionStats, setReactionStats] = useState<{emoji: string, username: string, date: string}[]>([]);
  const [replyCount, setReplyCount] = useState(initialStats?.replyCount || 0);
  const [readCount, setReadCount] = useState(initialStats?.readCount || 0);
  const [showReactionEmoji, setShowReactionEmoji] = useState(false);
  const [reactionEmoji, setReactionEmoji] = useState<string | undefined>(route.params.reactionEmoji);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [statsRefreshed, setStatsRefreshed] = useState(false); // Track if stats have been refreshed from database
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setUnreadReactionsCount } = useNotification();
  const [dataSource, setDataSource] = useState<'passed' | 'fetched'>(letterData ? 'passed' : 'fetched');

  const fetchLetter = async () => {
    try {
      // If we already have letter data from navigation params, only fetch stats
      if (letter && dataSource === 'passed') {
        console.log('Using passed letter data, only fetching stats');
        fetchLetterStats();
        fetchThreads();
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      setLoading(true);
      
      // Fetch the letter details
      const { data: fetchedLetterData, error: letterError } = await supabase
        .from('letters')
        .select(`
          *,
          display_name,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .eq('id', letterId)
        .single();

      if (letterError) {
        console.error('Error fetching letter:', letterError);
        return;
      }

      if (fetchedLetterData) {
        setLetter(fetchedLetterData as LetterWithDetails);
        setDataSource('fetched');
        
        // Fetch stats about this letter
        fetchLetterStats();
        
        // Fetch threads with at least one reply
        fetchThreads();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const fetchLetterStats = async () => {
    if (!letterId || !user) return;
    
    try {
      // If we have initial stats and this is the first load, we can skip some fetches
      const isInitialLoad = dataSource === 'passed' && !refreshing;
      
      // Get the list of blocked user IDs first
      const { blockedIds, error: blockError } = await getBlockedUserIds();
      
      if (blockError) {
        console.error('Error fetching blocked users:', blockError);
        // Continue with fetching stats even if there was an error getting blocked users
      }
      
      console.log(`[MyLetterDetailScreen] Fetched ${blockedIds.length} blocked users for letter stats`);      
      // Log detailed information about the blocked users
      if (blockedIds.length > 0) {
        console.log(`[MyLetterDetailScreen] Blocked user IDs: ${blockedIds.join(', ')}`);
      }
      
      // Define the type for the reaction data returned by our custom function
      type ReactionWithUsername = {
        reaction_type: string;
        created_at: string;
        username: string;
        user_id: string; // This field is now returned from the updated RPC function
      };

      // Always fetch reactions since they're not passed from the list screen
      const { data: reactionsData, error: reactionsError } = await supabase
        .rpc('get_letter_reactions_with_userids', { letter_id_param: letterId }) as { 
          data: ReactionWithUsername[] | null, 
          error: any 
        };
        
      if (reactionsError) {
        console.error('Error fetching reactions:', reactionsError);
        setReactionStats([]);
      } else if (reactionsData && reactionsData.length > 0) {
        console.log(`[MyLetterDetailScreen] Processing ${reactionsData.length} reactions`);    
        
        // Log detailed info about each reaction for debugging
        reactionsData.forEach((reaction, index) => {
          console.log(`[MyLetterDetailScreen] Reaction ${index + 1}: user_id=${reaction.user_id}, username=${reaction.username || 'Unknown'}`);
        });
          
        // Filter out reactions from blocked users (in both directions)
        const filteredReactions = reactionsData.filter(reaction => {
          // Skip this check if no user_id (shouldn't happen but being safe)
          if (!reaction.user_id) {
            console.log(`[MyLetterDetailScreen] Keeping reaction without user_id`);
            return true;
          }
          
          // Check if this reaction owner is in our blocked users list
          const isBlocked = blockedIds.includes(reaction.user_id);
          
          if (isBlocked) {
            console.log(`[MyLetterDetailScreen] Filtering out reaction from blocked user: ${reaction.username || 'Unknown'} (${reaction.user_id})`);
          } else {
            console.log(`[MyLetterDetailScreen] Keeping reaction from user: ${reaction.username || 'Unknown'} (${reaction.user_id})`);
          }
          
          // Keep the reaction only if the user is not blocked in either direction
          return !isBlocked;
        });
        
        console.log(`[MyLetterDetailScreen] Filtered out ${reactionsData.length - filteredReactions.length} reactions from blocked users`);
        
        // Format reactions for display
        const formattedReactions = filteredReactions.map(reaction => ({
          emoji: reaction.reaction_type,
          username: reaction.username || 'Anonymous',
          date: format(new Date(reaction.created_at), 'MMM d')
        }));
        
        setReactionStats(formattedReactions);
      } else {
        setReactionStats([]);
      }
      
      // After initial stats, always fetch the reply count - especially important after reporting
      // Use the database function to count replies excluding blocked users
      const { data: replyCount, error: countError } = await supabase
        .rpc('count_letter_replies_excluding_blocked', {
          p_letter_id: letterId,
          p_user_id: user.id
        });
        
      if (countError) {
        console.error('Error fetching replies count:', countError);
      } else {
        // Log detailed information about the reply count update
        console.log(`[MyLetterDetailScreen] Previous reply count: ${replyCount}`);
        console.log(`[MyLetterDetailScreen] Updating UI reply count to: ${replyCount || 0}`);
        
        // Force update the reply count state and mark stats as refreshed
        setReplyCount(replyCount || 0);
        setStatsRefreshed(true);
      }
      
      // Only fetch read count if we don't have initial stats or if refreshing
      if (!isInitialLoad || initialStats?.readCount === undefined) {
        const { data: readsData, error: readsError } = await supabase
          .from('letter_reads')
          .select('id', { count: 'exact' })
          .eq('letter_id', letterId);
          
        if (readsError) {
          console.error('Error fetching read count:', readsError);
        } else {
          setReadCount(readsData?.length || 0);
        }
      }
      
    } catch (error) {
      console.error('Error processing letter stats:', error);
    }
  };

  const fetchThreads = async () => {
    if (!letterId || !user) return;
    
    try {
      // Get the list of blocked user IDs first
      const { blockedIds, error: blockError } = await getBlockedUserIds();
      
      if (blockError) {
        console.error('Error fetching blocked users:', blockError);
        // Continue with fetching threads even if there was an error getting blocked users
      }
      
      console.log(`[MyLetterDetailScreen] Fetched ${blockedIds.length} blocked users`);
      
      // Use the database function to fetch replies excluding blocked users and reported threads
      const { data: repliesData, error: repliesError } = await supabase
        .rpc('get_letter_replies_excluding_blocked', {
          p_letter_id: letterId,
          p_user_id: user.id
        });
      
      if (repliesError) {
        console.error('Error fetching replies:', repliesError);
        return;
      }
      console.log(letterId);
      console.log(user.id);
      console.log(`[MyLetterDetailScreen] Fetched ${repliesData?.length || 0} replies (excluding blocked users and reported threads)`);
      
      // Filter out replies from blocked users on the frontend side as an additional layer
      // This is a temporary solution until the database function works correctly
      let filteredReplies = repliesData;
      if (blockedIds.length > 0 && repliesData) {
        console.log(`[MyLetterDetailScreen] Applying frontend filter for ${blockedIds.length} blocked users`);
        filteredReplies = repliesData.filter((reply: ReplyWithDetails) => {
          // Filter out replies where author or recipient is in blockedIds
          const authorIsBlocked = blockedIds.includes(reply.author_id);
          const recipientIsBlocked = reply.reply_to_user_id && blockedIds.includes(reply.reply_to_user_id);
          const keepReply = !authorIsBlocked && !recipientIsBlocked;
          return keepReply;
        });
        console.log(`[MyLetterDetailScreen] After frontend filtering: ${filteredReplies.length} replies (removed ${repliesData.length - filteredReplies.length})`);
        
        // If we filtered out replies, also update the reply count in the UI immediately
        // This ensures the count is consistent with what's displayed
        if (filteredReplies.length !== repliesData.length) {
          console.log(`[MyLetterDetailScreen] Updating reply count in UI from ${replyCount} to ${filteredReplies.length}`);
          setReplyCount(filteredReplies.length);
        }
      }
      
      if (filteredReplies && filteredReplies.length > 0) {
        
        // Create a map to track unique conversations by participant
        const conversationsByParticipant: { [participantId: string]: ReplyWithDetails[] } = {};
        
        // Group replies into conversations between the letter author (current user) and each participant
        filteredReplies.forEach((reply: ReplyWithDetails) => {
          let participantId: string;
          
          // Determine the conversation participant (the person who's not the current user)
          if (reply.author_id === user.id) {
            // If current user wrote this reply, the participant is who they replied to
            // Make sure it's not null; fallback to author_id if needed
            participantId = reply.reply_to_user_id || reply.author_id;
          } else {
            // If someone else wrote this reply to the current user, the participant is the author
            participantId = reply.author_id;
          }
          
          // Only include replies that are part of a conversation with the current user
          if (reply.author_id === user.id || reply.reply_to_user_id === user.id) {
            if (!conversationsByParticipant[participantId]) {
              conversationsByParticipant[participantId] = [];
            }
            conversationsByParticipant[participantId].push(reply);
          }
        });

        // Create a thread summary for each conversation participant
        const processedThreads: Thread[] = Object.entries(conversationsByParticipant).map(([participantId, participantReplies]) => {
          const latestReply = participantReplies[participantReplies.length - 1]; // Last one is latest due to ascending order
          return {
            id: `${letterId}-${participantId}`, // Unique key for the list item
            replierId: participantId,
            latestReplyDate: latestReply.created_at,
            latestReplyContent: latestReply.content,
            replyCount: participantReplies.length,
            replierName: participantReplies.find(r => r.author_id === participantId)?.display_name || 'User', // Use display name from participant's reply
            latestReplyAuthorId: latestReply.author_id
          };
        });

        // Sort threads by the latest reply date, newest first
        processedThreads.sort((a, b) => new Date(b.latestReplyDate).getTime() - new Date(a.latestReplyDate).getTime());

        setThreads(processedThreads);
      } else {
        setThreads([]);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  };

  // Mark reactions as read when the letter author views the letter
  const markReactionsAsRead = async () => {
    if (!letterId || !user || !letter) return;
    
    // Only mark reactions as read if the current user is the letter author
    if (letter.author_id === user.id) {
      try {
        console.log(`Marking reactions as read for letter: ${letterId}`);
        const { error } = await supabase.rpc('mark_letter_reactions_as_read', {
          letter_id_param: letterId,
          user_id_param: user.id
        });
        
        if (error) {
          console.error('Error marking reactions as read:', error);
        } else {
          console.log('Successfully marked reactions as read');
          
          // Update the notification badge count
          // Get the actual count of letters with unread reactions (excluding this one)
          try {
            // Query to count letters with unread reactions (excluding the current letter)
            const { data: unreadLetters, error: unreadError } = await supabase
              .rpc('get_my_letters_with_stats', { user_id: user.id })
              .select('id, has_unread_reactions');
              
            // Filter the results locally since RPC doesn't support the same filtering syntax
            const filteredUnreadLetters = unreadLetters?.filter(
              (letter: { id: string, has_unread_reactions: boolean }) => 
                letter.has_unread_reactions && letter.id !== letterId
            ) || [];
            
            if (unreadError) {
              console.error('Error fetching unread reactions count:', unreadError);
            } else {
              // Update with the actual count of other letters with unread reactions
              setUnreadReactionsCount(filteredUnreadLetters.length);
              console.log(`Updated unread reactions count: ${filteredUnreadLetters.length}`);
            }
          } catch (countError) {
            console.error('Exception counting unread reactions:', countError);
          }
          
          // Force fetching fresh data when user returns to MyLettersTab
          // by saving current timestamp to AsyncStorage
          AsyncStorage.setItem('reactions_last_read', Date.now().toString());
        }
      } catch (error) {
        console.error('Exception marking reactions as read:', error);
      }
    }
  };

  useEffect(() => {
    fetchLetter();
    
    // Preload mailbox tab data in the background
    if (user?.id) {
      detailScreenPreloader.preloadMailboxDataFromDetailScreen(user.id);
    }
  }, [letterId, user?.id]);
  
  // Handle reaction emoji animation when coming from notification
  useEffect(() => {
    console.log('[MyLetterDetailScreen] Animation check - reactionEmoji:', reactionEmoji, 'loading:', loading);
    
    if (reactionEmoji && !loading) {
      console.log('[MyLetterDetailScreen] Setting up animation timer for emoji:', reactionEmoji);
      // Short delay to ensure the screen is fully rendered
      const timer = setTimeout(() => {
        console.log('[MyLetterDetailScreen] Triggering animation for emoji:', reactionEmoji);
        setShowReactionEmoji(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [reactionEmoji, loading]);

  // Add AppState listener to refresh data when app comes back from background
  useEffect(() => {
    fetchLetter();
    
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user && letterId) {
        console.log('[MyLetterDetailScreen] App came to foreground, refreshing letter data');
        fetchLetter();
      }
    });
    
    return () => {
      appStateSubscription.remove();
    };
  }, [user, letterId]);
  
  // Mark reactions as read when viewing this letter
  useEffect(() => {
    if (letter) {
      markReactionsAsRead();
    }
  }, [letter]);
  
  // Refresh conversation data when returning to this screen (e.g., after replying or reporting in ThreadDetailScreen)
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh if we already have loaded the letter
      if (letter && !loading) {
        console.log('MyLetterDetailScreen is focused again, refreshing threads and stats...');
        // Refresh threads to update the conversation list
        fetchThreads();
        
        // Also refresh letter stats to update the reply count
        // This is particularly important after reporting a thread
        fetchLetterStats();
      }
      return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [letter, loading])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetter();
  };
  
  const handleDeleteLetter = () => {
    // In a real implementation, this would delete the letter
    // For now, we'll just show a confirmation message
    alert('Delete letter functionality would go here');
  };
  
  // Updated function to navigate to the specific thread with a participant
  const navigateToThread = (participantId: string) => {
    navigation.navigate('ThreadDetail', { 
      letterId: letterId, 
      otherParticipantId: participantId // Pass the specific replier ID
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error }}>Letter not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Only show custom header when not in modal mode */}
      {!isModal && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.onBackground} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>My Mail</Text>
          
          <View style={styles.headerButtons}>
            {/* Empty view with fixed width to balance the header */}
          </View>
        </View>
      )}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <LetterTitleCard letter={letter} />
        
        {reactionStats.length > 0 && (
          <View style={styles.reactionsContainer}>
            {reactionStats.map((reaction, index) => (
              <ReactionDisplay
                key={index}
                username={reaction.username}
                emoji={reaction.emoji}
                date={reaction.date}
                isCurrentUser={false}
              />
            ))}
          </View>
        )}

        <View style={styles.letterContent}>
          <Paragraph style={[styles.content, { color: theme.colors.onSurface }]}>
            {letter.content}
          </Paragraph>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={20} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {readCount} reads
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.colors.onSurfaceVariant} />
              {/* Using key to force re-render when replyCount changes */}
              <Text 
                key={`reply-count-${replyCount}`} 
                style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}
              >
                {replyCount} replies
              </Text>
            </View>
          </View>
          
          {/* Conversations section - using regular Views instead of FlatList */}
          {threads.length > 0 && (
            <View style={styles.threadsContainer}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                Conversations
              </Text>
              {threads.map(item => (
                <TouchableOpacity key={item.id} onPress={() => navigateToThread(item.replierId)}>
                  <Card style={styles.threadCard}>
                    <Card.Content>
                      <View style={styles.threadHeader}>
                        <Text style={[styles.threadReplier, { color: theme.colors.primary }]}>
                          {item.replierName}
                        </Text>
                        <Text style={[styles.threadDate, { color: theme.colors.onSurfaceDisabled }]}>
                          {format(new Date(item.latestReplyDate), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      <Text 
                        style={[styles.threadPreview, { color: theme.colors.onSurfaceVariant }]} 
                        numberOfLines={2}
                      >
                        {item.latestReplyAuthorId === user?.id ? "You: " : `${item.replierName}: `}
                        {item.latestReplyContent}
                      </Text>
                      <View style={styles.threadFooter}>
                        <Text style={[styles.replyCount, { color: theme.colors.onSurfaceDisabled }]}>
                          {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Animated reaction emoji from notification */}
      {reactionEmoji && (
        <AnimatedEmoji
          emoji={reactionEmoji}
          visible={showReactionEmoji}
          animation="random"
          duration={1500}  /* Slightly shorter animation duration */
          onAnimationComplete={() => {
            console.log('[MyLetterDetailScreen] Animation completed');
            // Shorter delay before hiding
            setTimeout(() => setShowReactionEmoji(false), 100);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
    width: 40, // Fixed width to balance the header
  },
  headerButtons: {
    flexDirection: 'row',
    width: 40, // Fixed width to match the closeButton
  },
  deleteButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  letterContent: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorName: {
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 0,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  statText: {
    marginLeft: 6,
    fontSize: 14,
  },
  reactionsContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  reactionsList: {
    flexDirection: 'column',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  reactionText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  threadsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  threadCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  threadReplier: {
    fontWeight: '600',
    fontSize: 14,
  },
  threadDate: {
    fontSize: 12,
  },
  threadPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  replyCount: {
    fontSize: 12,
  },
});

export default MyLetterDetailScreen; 