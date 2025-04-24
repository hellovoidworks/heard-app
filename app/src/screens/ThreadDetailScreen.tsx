import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { Adjust, AdjustEvent } from 'react-native-adjust';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Modal, TouchableOpacity, Keyboard } from 'react-native';
import BlockReportBottomSheet, { BlockReportBottomSheetRef } from '../components/BlockReportBottomSheet';
import ReportReasonModal from '../components/ReportReasonModal';
import { reportContent, ReportType } from '../services/reportService';
import { 
  Text, 
  Card, 
  Title, 
  Paragraph, 
  ActivityIndicator, 
  Chip, 
  Button, 
  TextInput,
  Surface,
  Divider,
  useTheme,
  IconButton
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { LetterWithDetails, ReplyWithDetails } from '../types/database.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LetterTitleCard from '../components/LetterTitleCard';
import ReactionDisplay from '../components/ReactionDisplay';
import detailScreenPreloader from '../utils/detailScreenPreloader';

type Props = NativeStackScreenProps<RootStackParamList, 'ThreadDetail'>;

const ThreadDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId, otherParticipantId, initialCorrespondence, presentationMode = 'push' } = route.params; // Get all params with default presentation mode
  
  // Create initial letter data from correspondence if available
  const initialLetterData = useMemo(() => {
    if (!initialCorrespondence) return null;
    
    return {
      id: initialCorrespondence.letter_id,
      title: initialCorrespondence.letter_title,
      author_id: initialCorrespondence.letter_author_id,
      display_name: initialCorrespondence.letter_display_name || '',
      // We don't have content yet, but can set other fields
      created_at: initialCorrespondence.most_recent_interaction_at, // Approximate until we get real data
      category: initialCorrespondence.category_name ? {
        name: initialCorrespondence.category_name,
        color: initialCorrespondence.category_color || '#888888',
      } : null,
      mood_emoji: initialCorrespondence.mood_emoji,
    } as Partial<LetterWithDetails>;
  }, [initialCorrespondence]);
  
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [replies, setReplies] = useState<ReplyWithDetails[]>([]);
  const [userReaction, setUserReaction] = useState<{emoji: string, date: string} | null>(null);
  const [letterLoading, setLetterLoading] = useState(!initialLetterData); // Loading state for letter data
  const [repliesLoading, setRepliesLoading] = useState(true); // Loading state for replies
  const [dataLoaded, setDataLoaded] = useState(false); // Track when data is loaded but not yet scrolled
  const [isFullyLoaded, setIsFullyLoaded] = useState(false); // Final state when everything is loaded AND scrolled
  const [replyText, setReplyText] = useState('');
  const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blockReportBottomSheetRef = useRef<BlockReportBottomSheetRef>(null);
  const { user, profile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const fetchLetterAndReplies = useCallback(async () => {
    if (!user || !letterId || !otherParticipantId) return;

    // Reset all loading states
    setIsFullyLoaded(false);
    if (!initialLetterData) {
      setLetterLoading(true);
    }
    setRepliesLoading(true);
    setError(null);
    // Don't clear letter if we have initialLetterData
    if (!initialLetterData) {
      setLetter(null);
    }
    setReplies([]);
    setUserReaction(null);

    try {
      console.log(`[ThreadDetailScreen] Calling get_thread_details with letterId: ${letterId}, userId: ${user.id}, otherParticipantId: ${otherParticipantId}`);
      
      const { data, error: rpcError } = await supabase.rpc('get_thread_details', {
        p_letter_id: letterId,
        p_user_id: user.id,
        p_other_participant_id: otherParticipantId
      });

      if (rpcError) {
        console.error('Error calling get_thread_details:', rpcError);
        setError(rpcError.message);
        setLetterLoading(false);
        return;
      }

      if (!data) {
        console.error('No data returned from get_thread_details');
        setError('Could not load thread details.');
        setLetterLoading(false);
        return;
      }
      
      console.log('[ThreadDetailScreen] Received data from get_thread_details:', JSON.stringify(data, null, 2));

      const fetchedLetter = data.letter;
      const fetchedReplies = data.replies;

      if (!fetchedLetter) {
        console.error('Letter data missing in get_thread_details response');
        setError('Could not load the letter.');
        setLetterLoading(false);
        return;
      }

      console.log('[ThreadDetailScreen] Fetched Letter Data:', fetchedLetter);
      console.log('[ThreadDetailScreen] Fetched Replies Data:', fetchedReplies);

      setLetter(fetchedLetter);
      setReplies(fetchedReplies || []);
      
      // Fetch user's reaction to this letter
      await fetchUserReaction(fetchedLetter.id);
      
    } catch (e: any) {
      console.error('Unexpected error fetching thread details:', e);
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setLetterLoading(false);
      setRepliesLoading(false);
    }
  }, [letterId, user, otherParticipantId, supabase]);

  const fetchUserReaction = async (letterId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('reaction_type, created_at')
        .eq('user_id', user.id)
        .eq('letter_id', letterId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is the error code for no rows returned
        console.error('Error fetching user reaction:', error);
        return;
      }
      
      if (data) {
        console.log('[ThreadDetailScreen] User reaction found:', data);
        const formattedDate = format(new Date(data.created_at), 'MMM d');
        setUserReaction({
          emoji: data.reaction_type,
          date: formattedDate
        });
      } else {
        console.log('[ThreadDetailScreen] No user reaction found');
        setUserReaction(null);
      }
    } catch (error) {
      console.error('Error fetching user reaction:', error);
    }
  };

  const markRepliesAsRead = async (replyIds: string[]) => {
    if (!user) return;
    
    try {
      const readRecords = replyIds.map(replyId => ({
        user_id: user.id,
        reply_id: replyId,
        read_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('reply_reads')
        .upsert(readRecords, {
          onConflict: 'user_id,reply_id',
          ignoreDuplicates: true
        });
        
      if (error) {
        console.error('Error marking replies as read:', error);
      }
    } catch (error) {
      console.error('Error marking replies as read:', error);
    }
  };

  const handleSendReply = async () => {
    console.log('>>> handleSendReply called. Letter Author ID:', letter?.author_id, 'Current User ID:', user?.id, 'Other Participant ID:', otherParticipantId); 

    if (!user || !profile || !replyText.trim() || !letter || !otherParticipantId) {
      console.warn('>>> handleSendReply aborted. Missing data:', { userId: user?.id, profileExists: !!profile, replyText: replyText.trim(), letterId: letter?.id, otherParticipantId });
      return; 
    }
    
    let recipientUserId: string | null = null;

    if (user.id === letter.author_id) {
      recipientUserId = otherParticipantId;
      console.log('>>> Current user is the letter author. Replying to otherParticipantId:', recipientUserId);
    } 
    else {
      recipientUserId = letter.author_id;
      console.log('>>> Current user is NOT the letter author. Replying to letter author:', recipientUserId);
    }

    if (!recipientUserId) {
        console.error('>>> Could not determine recipientUserId. Aborting reply.');
        setSendingReply(false); 
        return;
    }
    
    try {
      setSendingReply(true);

      const replyPayload = {
        letter_id: letter.id,
        author_id: user.id,
        display_name: profile.username, 
        content: replyText,
        reply_to_id: null, 
        reply_to_user_id: recipientUserId 
      };
      
      console.log('>>> Sending Reply Payload:', JSON.stringify(replyPayload, null, 2)); 

      const { data, error } = await supabase
        .from('replies')
        .insert([replyPayload]) 
        .select()
        .single();
        
      if (error) {
        console.error('Error sending reply:', error);
        return;
      }
      
      if (data) {
        // Track the Sent Reply event with Adjust
        const adjustEvent = new AdjustEvent('f5erqb');
        Adjust.trackEvent(adjustEvent);
        
        setReplies([...replies, data as ReplyWithDetails]); 
        setReplyText(''); 
        
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);

      }
    } catch (error) {
      console.error('Error sending reply catch block:', error);
    } finally {
      setSendingReply(false);
    }
  };
  
  const handleBlock = () => {
    // Close the bottom sheet
    blockReportBottomSheetRef.current?.close();
    
    // Show confirmation alert before blocking
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? You will no longer see any content from them, and they will not be able to see your content.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            // In a real implementation, we would call the API to block the user
            console.log(`Blocking user: ${otherParticipantId}`);
            
            // Here you would add the actual blocking logic
            // Then navigate back
            navigation.goBack();
          }
        }
      ]
    );
  };
  
  const handleReport = (reason?: string) => {
    // If we have a reason, it means the modal has already been shown
    // and we're getting the callback with the reason
    if (reason) {
      handleSubmitReportWithReason(reason);
    }
  };
  
  const handleSubmitReportWithReason = async (reason: string) => {
    // Show loading indicator or toast message
    // You could add a loading state here if desired
    
    try {
      // Call the report content API with other participant ID
      const { success, error } = await reportContent(
        letterId, 
        ReportType.REPLY, 
        reason, 
        otherParticipantId // Pass the other participant ID
      );
      
      if (success) {
        // Show success message
        console.log('Reply reported successfully');
        
        // Preload mailbox data to ensure the thread is hidden when returning to correspondence tab
        if (user) {
          console.log('[ThreadDetailScreen] Preloading mailbox data after successful report');
          detailScreenPreloader.preloadMailboxDataFromDetailScreen(user.id);
        }
        
        // Show success alert and navigate back only after user clicks OK
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. This thread will be hidden.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Close modal or navigate back based on presentation mode
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        // Show error message
        console.error('Failed to report reply:', error);
        Alert.alert('Report Failed', 'Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error('Error reporting reply:', error);
      Alert.alert('Error', 'An error occurred while submitting your report. Please try again.');
    }
  };
  
  const renderBlockReportBottomSheet = () => {
    return (
      <BlockReportBottomSheet
        ref={blockReportBottomSheetRef}
        onBlock={handleBlock}
        onReport={handleReport}
        contentType="thread"
      />
    );
  };

  // Set initial letter data if available
  useEffect(() => {
    if (initialLetterData && !letter) {
      setLetter(initialLetterData as LetterWithDetails);
    }
  }, [initialLetterData, letter]);

  // Set up navigation header with ellipsis button when using push navigation
  useEffect(() => {
    if (presentationMode === 'push') {
      navigation.setOptions({
        headerRight: () => (
          <IconButton
            icon="dots-horizontal"
            iconColor="white"
            size={24}
            onPress={() => blockReportBottomSheetRef.current?.open()}
          />
        )
      });
    }
  }, [navigation, presentationMode]);

  useEffect(() => {
    fetchLetterAndReplies();
    
    // Preload mailbox tab data in the background
    if (user?.id) {
      detailScreenPreloader.preloadMailboxDataFromDetailScreen(user.id);
    }
  }, [letterId, otherParticipantId, user]); 

  // Add AppState listener to refresh data when app comes back from background
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user) {
        console.log('[ThreadDetailScreen] App came to foreground, refreshing thread data');
        fetchLetterAndReplies();
      }
    });
    
    return () => {
      appStateSubscription.remove();
    };
  }, [fetchLetterAndReplies, user]);


  // Track when data is loaded but not yet scrolled
  useEffect(() => {
    if (!letterLoading && !repliesLoading) {
      setDataLoaded(true);
    }
  }, [letterLoading, repliesLoading]);

  // Handle actions when data is loaded - mark replies as read
  useEffect(() => {
    if (dataLoaded && letter && replies.length > 0) {
      console.log('[ThreadDetailScreen] Data loaded, marking replies as read');
      
      // Mark all replies from the other participant as read
      const unreadReplyIds = replies
        .filter(reply => reply.author_id === otherParticipantId)
        .map(reply => reply.id);
        
      if (unreadReplyIds.length > 0) {
        console.log('[ThreadDetailScreen] Marking replies as read:', unreadReplyIds);
        markRepliesAsRead(unreadReplyIds);
      }
    }
  }, [dataLoaded, letter, replies, otherParticipantId, markRepliesAsRead]);
  
  // Handle transition from loading to displaying content
  useEffect(() => {
    if (dataLoaded && letter && !isFullyLoaded) {
      // First set the content as visible
      console.log('[ThreadDetailScreen] Data loaded, transitioning to fully loaded state');
      setIsFullyLoaded(true);
    }
  }, [dataLoaded, letter, isFullyLoaded]);
  
  // Handle scrolling after content is visible and layout is calculated
  useEffect(() => {
    if (isFullyLoaded && replies.length > 0) {
      // Use a series of attempts to scroll to ensure it happens
      const scrollAttempts = [10, 50, 100, 200, 500];
      
      scrollAttempts.forEach(delay => {
        setTimeout(() => {
          if (scrollViewRef.current) {
            console.log(`[ThreadDetailScreen] Scroll attempt at ${delay}ms`);
            scrollViewRef.current.scrollToEnd({ animated: false });
          }
        }, delay);
      });
    }
  }, [isFullyLoaded, replies.length]);

  const canReply = useMemo(() => {
    if (!user) return false;
    
    if (replies.length === 0) {
      return letter?.author_id !== user.id;
    }
    
    const latestReply = replies[replies.length - 1];
    return latestReply.author_id !== user.id;
  }, [user, letter, replies]);

  // Show loading screen until everything is fully loaded and properly scrolled
  if (!isFullyLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onBackground }}>Letter not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {renderBlockReportBottomSheet()}
      {/* Only show the ellipsis in the content area when in modal mode */}
      {presentationMode === 'modal' && (
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.moreButton} onPress={() => blockReportBottomSheetRef.current?.open()}>
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ 
          paddingBottom: canReply ? 8 : Math.max(insets.bottom, 16) 
        }}
        onContentSizeChange={() => {
          // When content size changes and we're fully loaded, scroll to bottom
          if (isFullyLoaded && replies.length > 0) {
            console.log('[ThreadDetailScreen] Content size changed, scrolling to end');
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={() => {
          // Also scroll when layout is calculated
          if (isFullyLoaded && replies.length > 0) {
            console.log('[ThreadDetailScreen] Layout calculated, scrolling to end');
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }
        }}
      >
        {/* Letter Title Card */}
        {letter && <LetterTitleCard letter={letter} />}
        
        {/* User Reaction */}
        {userReaction && (
          <View style={styles.reactionContainer}>
            <ReactionDisplay
              username=""
              emoji={userReaction.emoji}
              date={userReaction.date}
              isCurrentUser={true}
            />
          </View>
        )}
        
        {/* Original Letter */}
        <Paragraph style={[styles.originalLetter, { color: theme.colors.onSurface }]}>
          {letter.content}
        </Paragraph>
        
        {replies.length > 0 && <Divider style={[styles.divider, { backgroundColor: theme.colors.surfaceDisabled }]} />}
        
        {/* No need for separate replies loading indicator since we now wait for everything to load */}
        {replies.map((reply) => {
          const isFromCurrentUser = user && reply.author_id === user.id;
          const isFromLetterAuthor = reply.author_id === letter.author_id;
          
          // Use the letter's display_name for the letter author's replies
          // Otherwise use the reply's display_name for other participants
          const displayName = isFromLetterAuthor ? letter.display_name : reply.display_name;
          
          return (
            <Surface 
              key={reply.id} 
              style={[
                styles.messageBubble,
                { backgroundColor: theme.colors.surface },
                isFromCurrentUser ? 
                  [styles.sentBubble, { backgroundColor: `${theme.colors.primary}40` }] : 
                  [styles.receivedBubble, { backgroundColor: theme.colors.surfaceVariant }]
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={[
                  styles.authorName,
                  { color: '#FFFFFF', opacity: 0.5 }
                ]}>
                  {displayName}
                </Text>
                <Text style={[
                  styles.messageDate,
                  { color: '#FFFFFF', opacity: 0.5 }
                ]}>
                  {format(new Date(reply.created_at), 'MMM d')}
                </Text>
              </View>
              <Paragraph style={[
                styles.messageContent,
                { color: isFromCurrentUser ? theme.colors.onPrimary : theme.colors.onSurface }
              ]}>
                {reply.content}
              </Paragraph>
            </Surface>
          );
        })}
      </ScrollView>
      
      {/* Reply Input - Only show if the user can reply */}
      {canReply && (
        <Surface style={[
          styles.replyContainer, 
          { 
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, 6)
          }
        ]}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write a reply..."
            placeholderTextColor={theme.colors.onSurfaceDisabled}
            multiline
            style={[styles.replyInput, { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.onSurface,
              borderBottomWidth: 0
            }]}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            selectionColor="#FFFFFF"
            cursorColor="#FFFFFF"
            theme={{ colors: { text: theme.colors.onSurface } }}
          />
          <Button
            mode="contained"
            onPress={handleSendReply}
            disabled={!replyText.trim() || sendingReply}
            loading={sendingReply}
            style={styles.sendButton}
            labelStyle={styles.sendButtonLabel}
            contentStyle={styles.sendButtonContent}
          >
            Send
          </Button>
        </Surface>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 5,
    paddingRight: 10,
    paddingBottom: 5,
    zIndex: 10,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    width: '100%',
  },
  optionItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomModalContent: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    elevation: 5,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
    marginTop: -10, // Reduce the gap between header and content
  },
  originalLetter: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  divider: {
    marginHorizontal: 16,
  },
  messageBubble: {
    margin: 8,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    elevation: 1,
  },
  sentBubble: {
    marginLeft: 32,
  },
  receivedBubble: {
    marginRight: 32,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    fontWeight: '600',
  },
  messageDate: {
    fontSize: 12,
  },
  messageContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  replyContainer: {
    padding: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  replyInput: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    maxHeight: 100,
  },
  sendButton: {
    alignSelf: 'center',
  },
  sendButtonLabel: {
    marginVertical: 1,
  },
  sendButtonContent: {
    paddingVertical: 4,
  },
  reactionContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  repliesLoadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ThreadDetailScreen; 