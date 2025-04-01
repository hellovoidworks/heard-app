import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
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
  useTheme
} from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { LetterWithDetails, ReplyWithDetails } from '../types/database.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LetterTitleCard from '../components/LetterTitleCard';

type Props = NativeStackScreenProps<RootStackParamList, 'ThreadDetail'>;

const ThreadDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId, otherParticipantId } = route.params; // Get both IDs
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [replies, setReplies] = useState<ReplyWithDetails[]>([]);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const { user, profile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const fetchLetterAndReplies = async () => {
    try {
      setLoading(true);
      
      // Ensure we have all necessary IDs
      if (!user || !letterId || !otherParticipantId) {
        console.warn('Missing user, letterId, or otherParticipantId');
        setLoading(false);
        return;
      }

      // Get the original letter
      const { data: letterData, error: letterError } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .eq('id', letterId)
        .single();

      if (letterError) {
        console.error('Error fetching letter:', letterError);
        return;
      }

      if (letterData) {
        setLetter(letterData as LetterWithDetails);
        
        // Fetch user's reaction for this letter
        const { data: reactionData, error: reactionError } = await supabase
          .from('reactions')
          .select('reaction_type')
          .eq('letter_id', letterId)
          .eq('user_id', user.id)
          .single();
          
        if (reactionError && reactionError.code !== 'PGRST116') { // Ignore not found error
          console.error('Error fetching user reaction:', reactionError);
        }
        
        if (reactionData) {
          setUserReaction(reactionData.reaction_type);
        }

        // Fetch ALL replies for the letter first
        const { data: repliesData, error: repliesError } = await supabase
          .from('replies') 
          .select('*') // Select all columns for simplicity
          .eq('letter_id', letterId)
          .order('created_at', { ascending: true });

        if (repliesError) {
          console.error('Error fetching replies:', repliesError);
          setReplies([]); // Clear replies on error
          return;
        }

        if (repliesData) {
          // Filter replies to only include those between the current user and the specific other participant
          const filteredReplies = repliesData.filter(reply => 
            reply.author_id === user.id || reply.author_id === otherParticipantId
          );

          // Display only the filtered replies relevant to this specific conversation pair
          setReplies(filteredReplies as ReplyWithDetails[]);
          
          // Identify unread replies *from the other participant* in this specific thread
          const unreadReplyIds = filteredReplies 
            .filter(reply => reply.author_id === otherParticipantId) // Only consider replies from the other participant
            .map(reply => reply.id);
            
          if (unreadReplyIds.length > 0) {
            await markRepliesAsRead(unreadReplyIds);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    if (!user || !profile || !replyText.trim() || !letter) return;
    
    try {
      setSendingReply(true);
      
      const { data, error } = await supabase
        .from('replies')
        .insert([
          {
            letter_id: letter.id,
            author_id: user.id,
            display_name: profile.username,
            content: replyText,
            reply_to_id: null // Direct reply to the letter, not to another reply
          }
        ])
        .select()
        .single();
        
      if (error) {
        console.error('Error sending reply:', error);
        return;
      }
      
      if (data) {
        // Add the new reply to the list
        setReplies([...replies, data as ReplyWithDetails]);
        setReplyText('');
        
        // Scroll to bottom after sending
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    fetchLetterAndReplies();
  }, [letterId, otherParticipantId, user]); // Add otherParticipantId dependency

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetterAndReplies();
  };

  // Scroll to bottom when thread loads
  useEffect(() => {
    if (!loading && replies.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [loading, replies.length]);

  // Determine if the user can reply (if the latest message is not from the current user)
  const canReply = useMemo(() => {
    if (!user) return false;
    
    // If there are no replies yet, the user can reply if they didn't author the letter
    if (replies.length === 0) {
      return letter?.author_id !== user.id;
    }
    
    // Otherwise, check if the latest reply is from another user
    const latestReply = replies[replies.length - 1];
    return latestReply.author_id !== user.id;
  }, [user, letter, replies]);

  if (loading && !refreshing) {
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
      {letter && <LetterTitleCard letter={letter} userReaction={userReaction} />}
      
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ 
          paddingBottom: canReply ? 8 : Math.max(insets.bottom, 16) 
        }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Original Letter */}
        <Surface style={[styles.originalLetter, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.messageHeader}>
            <Text style={[styles.authorName, { color: theme.colors.primary }]}>
              {letter.display_name || letter.author?.username || 'Unknown User'}
            </Text>
            <Text style={[styles.messageDate, { color: theme.colors.onSurfaceDisabled }]}>
              {format(new Date(letter.created_at), 'MMM d')}
            </Text>
          </View>
          <Paragraph style={[styles.messageContent, { color: theme.colors.onSurface }]}>
            {letter.content}
          </Paragraph>
        </Surface>
        
        {replies.length > 0 && <Divider style={[styles.divider, { backgroundColor: theme.colors.surfaceDisabled }]} />}
        
        {/* Replies */}
        {replies.map((reply) => {
          const isFromCurrentUser = user && reply.author_id === user.id;
          
          return (
            <Surface 
              key={reply.id} 
              style={[
                styles.messageBubble,
                { backgroundColor: theme.colors.surface },
                isFromCurrentUser ? 
                  [styles.sentBubble, { backgroundColor: theme.colors.primary }] : 
                  [styles.receivedBubble, { backgroundColor: theme.colors.surfaceVariant }]
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={[
                  styles.authorName,
                  { color: isFromCurrentUser ? theme.colors.onPrimary : theme.colors.primary }
                ]}>
                  {reply.display_name}
                </Text>
                <Text style={[
                  styles.messageDate,
                  { color: isFromCurrentUser ? theme.colors.onPrimary : theme.colors.onSurfaceDisabled }
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
  },
  originalLetter: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
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
    marginRight: 8,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    marginTop: -8,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    elevation: 1,
    alignSelf: 'flex-end',
    maxWidth: '70%',
  },
  reactionText: {
    fontSize: 14,
    textAlign: 'right',
  },
});

export default ThreadDetailScreen; 