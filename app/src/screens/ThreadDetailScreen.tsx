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
import { LetterWithDetails } from '../types/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'ThreadDetail'>;

const ThreadDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { threadId } = route.params;
  const [letters, setLetters] = useState<LetterWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const { user, profile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchThreadMessages = async () => {
    try {
      setLoading(true);
      
      if (!user || !threadId) return;

      // Get all letters in this thread
      const { data: lettersData, error: lettersError } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (lettersError) {
        console.error('Error fetching thread messages:', lettersError);
        return;
      }

      if (lettersData) {
        setLetters(lettersData as LetterWithDetails[]);
        
        // Mark unread messages as read
        const unreadLetterIds = lettersData
          .filter(letter => letter.author_id !== user.id)
          .map(letter => letter.id);
          
        if (unreadLetterIds.length > 0) {
          await markMessagesAsRead(unreadLetterIds);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const markMessagesAsRead = async (letterIds: string[]) => {
    if (!user) return;
    
    try {
      const readRecords = letterIds.map(letterId => ({
        user_id: user.id,
        letter_id: letterId,
        read_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('letter_reads')
        .upsert(readRecords, {
          onConflict: 'user_id,letter_id',
          ignoreDuplicates: true
        });
        
      if (error) {
        console.error('Error marking messages as read:', error);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendReply = async () => {
    if (!user || !profile || !replyText.trim() || letters.length === 0) return;
    
    try {
      setSendingReply(true);
      
      // Get the original letter (first letter in the thread)
      const originalLetter = letters[0];
      
      const { data, error } = await supabase
        .from('letters')
        .insert([
          {
            author_id: user.id,
            display_name: profile.username,
            title: `Re: ${originalLetter.title}`,
            content: replyText,
            category_id: originalLetter.category_id,
            parent_id: originalLetter.id,
            thread_id: threadId,
          }
        ])
        .select()
        .single();
        
      if (error) {
        console.error('Error sending reply:', error);
        return;
      }
      
      if (data) {
        // Add the new message to the list with author information
        const newMessage = {
          ...data,
          author: {
            id: user.id,
            username: profile.username
          }
        } as LetterWithDetails;
        
        setLetters([...letters, newMessage]);
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
    fetchThreadMessages();
  }, [threadId, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchThreadMessages();
  };

  // Scroll to bottom when thread loads
  useEffect(() => {
    if (!loading && letters.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [loading, letters.length]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (letters.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text>No messages found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  const originalLetter = letters[0];

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.header}>
        <Title>{originalLetter.title}</Title>
        <Chip icon="tag" style={styles.categoryChip}>
          {originalLetter.category?.name}
        </Chip>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {letters.map((letter, index) => {
          const isFromCurrentUser = user && letter.author_id === user.id;
          
          return (
            <Surface 
              key={letter.id} 
              style={[
                styles.messageBubble, 
                isFromCurrentUser ? styles.sentBubble : styles.receivedBubble
              ]}
            >
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
});

export default ThreadDetailScreen; 