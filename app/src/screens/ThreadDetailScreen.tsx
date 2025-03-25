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
  Divider,
  useTheme
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
  const theme = useTheme();

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
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Title style={{ color: theme.colors.onSurface }}>{letter.title}</Title>
        <Chip 
          icon="tag" 
          style={[styles.categoryChip, { backgroundColor: theme.colors.surface }]}
          textStyle={{ color: theme.colors.onSurface }}
        >
          {letter.category?.name}
        </Chip>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
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
      
      {/* Reply Input */}
      <Surface style={[styles.replyContainer, { backgroundColor: theme.colors.surface }]}>
        <TextInput
          value={replyText}
          onChangeText={setReplyText}
          placeholder="Write a reply..."
          placeholderTextColor={theme.colors.onSurfaceDisabled}
          multiline
          style={[styles.replyInput, { 
            backgroundColor: theme.colors.surface,
            color: theme.colors.onSurface
          }]}
          theme={{ colors: { text: theme.colors.onSurface } }}
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  categoryChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
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
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  replyInput: {
    flex: 1,
    marginRight: 8,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    alignSelf: 'flex-end',
  },
});

export default ThreadDetailScreen; 