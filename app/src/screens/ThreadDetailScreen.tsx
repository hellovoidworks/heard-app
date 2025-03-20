import React, { useState, useEffect, useRef } from 'react';
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
  Divider
} from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { LetterWithDetails, ReplyWithDetails } from '../types/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'ThreadDetail'>;

const ThreadDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId } = route.params; // Now using letterId instead of threadId
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [replies, setReplies] = useState<ReplyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const { user, profile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchLetterAndReplies = async () => {
    try {
      setLoading(true);
      
      if (!user || !letterId) return;

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
        
        // Get all replies to this letter
        const { data: repliesData, error: repliesError } = await supabase
          .from('replies')
          .select(`
            id,
            letter_id,
            author_id,
            display_name,
            content,
            reply_to_id,
            created_at,
            updated_at
          `)
          .eq('letter_id', letterId)
          .order('created_at', { ascending: true });

        if (repliesError) {
          console.error('Error fetching replies:', repliesError);
          return;
        }

        if (repliesData) {
          setReplies(repliesData as ReplyWithDetails[]);
          
          // Mark unread replies as read
          const unreadReplyIds = repliesData
            .filter(reply => reply.author_id !== user.id)
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
  }, [letterId, user]);

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

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={styles.emptyContainer}>
        <Text>Letter not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.header}>
        <Title>{letter.title}</Title>
        <Chip icon="tag" style={styles.categoryChip}>
          {letter.category?.name}
        </Chip>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Original Letter */}
        <Surface style={styles.originalLetter}>
          <View style={styles.messageHeader}>
            <Text style={styles.authorName}>
              {letter.display_name || letter.author?.username || 'Unknown User'}
            </Text>
            <Text style={styles.messageDate}>
              {format(new Date(letter.created_at), 'MMM d, h:mm a')}
            </Text>
          </View>
          <Paragraph style={styles.messageContent}>{letter.content}</Paragraph>
        </Surface>
        
        {replies.length > 0 && <Divider style={styles.divider} />}
        
        {/* Replies */}
        {replies.map((reply) => {
          const isFromCurrentUser = user && reply.author_id === user.id;
          
          return (
            <Surface 
              key={reply.id} 
              style={[
                styles.messageBubble, 
                isFromCurrentUser ? styles.sentBubble : styles.receivedBubble
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.authorName}>
                  {reply.display_name || reply.author?.username || 'Unknown User'}
                </Text>
                <Text style={styles.messageDate}>
                  {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                </Text>
              </View>
              <Paragraph style={styles.messageContent}>{reply.content}</Paragraph>
            </Surface>
          );
        })}
        <View style={styles.scrollPadding} />
      </ScrollView>
      
      <Surface style={styles.replyContainer}>
        <TextInput
          value={replyText}
          onChangeText={setReplyText}
          placeholder="Type your reply..."
          multiline
          style={styles.replyInput}
          disabled={sendingReply}
        />
        <Button 
          mode="contained" 
          onPress={handleSendReply} 
          disabled={!replyText.trim() || sendingReply}
          loading={sendingReply}
          style={styles.sendButton}
        >
          Send
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  scrollView: {
    flex: 1,
    padding: 16,
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
  originalLetter: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 24,
    elevation: 2,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    maxWidth: '80%',
    elevation: 1,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#e3f2fd',
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  authorName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageDate: {
    fontSize: 12,
    color: '#666',
  },
  messageContent: {
    fontSize: 16,
    lineHeight: 22,
  },
  replyContainer: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  replyInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: 'white',
  },
  sendButton: {
    marginLeft: 8,
  },
  scrollPadding: {
    height: 20,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  divider: {
    marginBottom: 16,
  },
});

export default ThreadDetailScreen; 