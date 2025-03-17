import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Card, Title, Paragraph, Divider, Button, Chip, ActivityIndicator, TextInput } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails, Letter } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'LetterDetail'>;

const LetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [replies, setReplies] = useState<LetterWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, profile } = useAuth();

  const fetchLetterAndReplies = async () => {
    try {
      setLoading(true);
      
      // Fetch the letter details
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
        
        // Fetch replies to this letter
        const { data: repliesData, error: repliesError } = await supabase
          .from('letters')
          .select(`
            *,
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .eq('parent_id', letterId)
          .order('created_at', { ascending: true });

        if (repliesError) {
          console.error('Error fetching replies:', repliesError);
        } else if (repliesData) {
          setReplies(repliesData as LetterWithDetails[]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLetterAndReplies();
  }, [letterId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetterAndReplies();
  };

  const handleSubmitReply = async () => {
    if (!user || !profile) {
      Alert.alert('Error', 'You must be logged in to reply');
      return;
    }

    if (!replyContent.trim()) {
      Alert.alert('Error', 'Reply cannot be empty');
      return;
    }

    setSubmitting(true);

    try {
      // Get thread_id (either the parent's thread_id or the parent's id if it's the first reply)
      const threadId = letter?.thread_id || letter?.id;

      const { data, error } = await supabase
        .from('letters')
        .insert([
          {
            author_id: user.id,
            display_name: profile.username, // Using username as display name by default
            title: `Re: ${letter?.title}`,
            content: replyContent,
            category_id: letter?.category_id,
            parent_id: letter?.id,
            thread_id: threadId,
          },
        ])
        .select();

      if (error) {
        Alert.alert('Error', error.message);
      } else if (data) {
        // Clear input and refresh to show the new reply
        setReplyContent('');
        fetchLetterAndReplies();
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
      Alert.alert('Error', 'Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={styles.errorContainer}>
        <Text>Letter not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Card style={styles.letterCard}>
        <Card.Content>
          <Title style={styles.title}>{letter.title}</Title>
          
          <View style={styles.metaContainer}>
            <Chip icon="account" style={styles.chip}>{letter.display_name}</Chip>
            <Chip icon="tag" style={styles.chip}>{letter.category?.name}</Chip>
            <Text style={styles.date}>
              {format(new Date(letter.created_at), 'MMM d, yyyy')}
            </Text>
          </View>
          
          <Paragraph style={styles.content}>{letter.content}</Paragraph>
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <View style={styles.repliesContainer}>
        <Text style={styles.repliesTitle}>Replies ({replies.length})</Text>
        
        {replies.map((reply) => (
          <Card key={reply.id} style={styles.replyCard}>
            <Card.Content>
              <View style={styles.replyHeader}>
                <Text style={styles.replyAuthor}>{reply.display_name}</Text>
                <Text style={styles.replyDate}>
                  {format(new Date(reply.created_at), 'MMM d, yyyy')}
                </Text>
              </View>
              <Paragraph>{reply.content}</Paragraph>
            </Card.Content>
          </Card>
        ))}

        {user && (
          <Card style={styles.replyInputCard}>
            <Card.Content>
              <TextInput
                label="Write a reply"
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
                style={styles.replyInput}
              />
              <Button
                mode="contained"
                onPress={handleSubmitReply}
                loading={submitting}
                disabled={submitting || !replyContent.trim()}
                style={styles.submitButton}
              >
                Reply
              </Button>
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
  letterCard: {
    margin: 16,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    alignItems: 'center',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
  divider: {
    marginVertical: 16,
  },
  repliesContainer: {
    padding: 16,
  },
  repliesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  replyCard: {
    marginBottom: 12,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  replyAuthor: {
    fontWeight: 'bold',
  },
  replyDate: {
    fontSize: 12,
    color: '#666',
  },
  replyInputCard: {
    marginTop: 16,
  },
  replyInput: {
    marginBottom: 16,
  },
  submitButton: {
    alignSelf: 'flex-end',
  },
});

export default LetterDetailScreen; 