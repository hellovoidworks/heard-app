import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Correspondence = {
  letter_id: string;
  title: string;
  last_message: string;
  last_message_date: string;
  unread_count: number;
  participants: string[];
};

const CorrespondenceTab = () => {
  const [correspondences, setCorrespondences] = useState<Correspondence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const fetchCorrespondences = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // First, get all letters authored by the current user
      const { data: authoredLetters, error: letterError } = await supabase
        .from('letters')
        .select('id, title, content, created_at, author_id')
        .eq('author_id', user.id);

      if (letterError) {
        console.error('Error fetching authored letters:', letterError);
        return;
      }

      // Get the unique letter IDs authored by the user
      const authoredLetterIds = authoredLetters ? authoredLetters.map(letter => letter.id) : [];
      
      // Next, get all replies by the current user to find letters they've replied to
      const { data: myReplies, error: myRepliesError } = await supabase
        .from('replies')
        .select('letter_id')
        .eq('author_id', user.id);
        
      if (myRepliesError) {
        console.error('Error fetching user replies:', myRepliesError);
        return;
      }
      
      // Extract unique letter IDs from replies (letters the user has replied to)
      const repliedToLetterIds = myReplies 
        ? [...new Set(myReplies.map(reply => reply.letter_id))]
        : [];
      
      // Get details of letters the user has replied to (that they did not author)
      const { data: repliedToLetters, error: repliedToLettersError } = await supabase
        .from('letters')
        .select('id, title, content, created_at, author_id')
        .in('id', repliedToLetterIds)
        .not('author_id', 'eq', user.id);  // Exclude letters the user authored
        
      if (repliedToLettersError) {
        console.error('Error fetching replied to letters:', repliedToLettersError);
        return;
      }
      
      // Combine both sets of letters
      const allRelevantLetters = [
        ...(authoredLetters || []),
        ...(repliedToLetters || [])
      ];
      
      if (allRelevantLetters.length === 0) {
        setCorrespondences([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get the complete set of letter IDs to work with
      const allLetterIds = allRelevantLetters.map(letter => letter.id);

      // Fetch replies for each letter
      const { data: replyData, error: replyError } = await supabase
        .from('replies')
        .select(`
          id, 
          letter_id, 
          content,
          author_id,
          created_at
        `)
        .in('letter_id', allLetterIds)
        .order('created_at', { ascending: false });

      if (replyError) {
        console.error('Error fetching replies:', replyError);
        return;
      }

      // Get count of unread replies
      const { data: unreadCounts, error: unreadError } = await supabase.rpc(
        'get_unread_reply_count',
        { p_user_id: user.id, p_letter_ids: allLetterIds }
      );

      if (unreadError) {
        console.error('Error fetching unread counts:', unreadError);
      }

      // Create a map for unread counts
      const unreadCountMap = new Map<string, number>();
      if (unreadCounts) {
        unreadCounts.forEach((item: { letter_id: string, unread_count: number }) => {
          unreadCountMap.set(item.letter_id, item.unread_count);
        });
      }

      // Group replies by letter_id
      const letterRepliesMap = new Map<string, Array<any>>();
      if (replyData) {
        replyData.forEach(reply => {
          if (!letterRepliesMap.has(reply.letter_id)) {
            letterRepliesMap.set(reply.letter_id, []);
          }
          letterRepliesMap.get(reply.letter_id)!.push(reply);
        });
      }

      // Format correspondences for each letter with replies
      const formattedCorrespondences = allRelevantLetters
        // Include letters authored by the user that have received replies
        // or letters authored by others that the user has replied to
        .filter(letter => {
          // For letters the user authored, only include those with replies from others
          if (letter.author_id === user.id) {
            return letterRepliesMap.has(letter.id);
          }
          // For letters authored by others, include them as long as the user has replied
          return letterRepliesMap.has(letter.id);
        })
        .map(letter => {
          const replies = letterRepliesMap.get(letter.id) || [];
          const latestReply = replies.length > 0 ? replies[0] : null;
          const participants = new Set<string>();
          
          participants.add(letter.author_id);
          replies.forEach(reply => participants.add(reply.author_id));
          
          return {
            letter_id: letter.id,
            title: letter.title,
            last_message: latestReply 
              ? latestReply.content.substring(0, 100) + (latestReply.content.length > 100 ? '...' : '')
              : letter.content.substring(0, 100) + (letter.content.length > 100 ? '...' : ''),
            last_message_date: latestReply ? latestReply.created_at : letter.created_at,
            unread_count: unreadCountMap.get(letter.id) || 0,
            participants: Array.from(participants) as string[],
          };
        })
        // Sort by the most recent message
        .sort((a, b) => new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime());

      setCorrespondences(formattedCorrespondences);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCorrespondences();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCorrespondences();
  };

  const handleCorrespondencePress = (correspondence: Correspondence) => {
    // Navigate to the thread detail screen with the letter ID
    navigation.navigate('ThreadDetail', { letterId: correspondence.letter_id });
  };

  const renderCorrespondenceItem = ({ item }: { item: Correspondence }) => (
    <Card 
      style={[styles.card, item.unread_count > 0 && styles.unreadCard]} 
      onPress={() => handleCorrespondencePress(item)}
    >
      <Card.Content>
        <View style={styles.headerRow}>
          <Title>{item.title}</Title>
          {item.unread_count > 0 && (
            <Chip mode="outlined" style={styles.unreadChip}>{item.unread_count}</Chip>
          )}
        </View>
        <Paragraph numberOfLines={2}>{item.last_message}</Paragraph>
        <Text style={styles.date}>
          {format(new Date(item.last_message_date), 'MMM d, yyyy')}
        </Text>
      </Card.Content>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={correspondences}
        renderItem={renderCorrespondenceItem}
        keyExtractor={(item) => item.letter_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No correspondence found</Text>
          </View>
        }
      />
    </View>
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
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  unreadChip: {
    backgroundColor: '#6200ee',
    color: 'white',
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  writeButton: {
    marginTop: 10,
  },
});

export default CorrespondenceTab; 