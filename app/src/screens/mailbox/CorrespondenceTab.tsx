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

type Thread = {
  id: string;
  title: string;
  last_message: string;
  last_message_date: string;
  unread_count: number;
  participants: string[];
};

interface LetterData {
  id: string;
  title: string;
  content: string;
  created_at: string;
  thread_id: string;
  parent_id: string | null;
  author_id: string;
  recipient_id: string;
  is_read?: boolean;
}

const CorrespondenceTab = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const fetchThreads = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // Get all letters that the user has either written or received
      const { data: lettersData, error: lettersError } = await supabase
        .from('letters')
        .select(`
          id,
          title,
          content,
          created_at,
          thread_id,
          parent_id,
          author_id,
          recipient_id
        `)
        .or(`author_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (lettersError) {
        console.error('Error fetching letters:', lettersError);
        return;
      }

      if (!lettersData || lettersData.length === 0) {
        setThreads([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Group letters by thread_id
      const threadMap = new Map<string, {
        id: string;
        title: string;
        letters: LetterData[];
        participants: Set<string>;
      }>();
      
      for (const letter of lettersData as LetterData[]) {
        // Skip letters without a thread_id (standalone letters)
        if (!letter.thread_id) continue;
        
        if (!threadMap.has(letter.thread_id)) {
          threadMap.set(letter.thread_id, {
            id: letter.thread_id,
            title: letter.title,
            letters: [],
            participants: new Set<string>(),
          });
        }
        
        const thread = threadMap.get(letter.thread_id)!;
        thread.letters.push(letter);
        
        // Add participants
        if (letter.author_id) thread.participants.add(letter.author_id);
        if (letter.recipient_id) thread.participants.add(letter.recipient_id);
      }
      
      // Format threads for display
      const formattedThreads = Array.from(threadMap.values()).map(thread => {
        // Sort letters by date (newest first)
        const sortedLetters = thread.letters.sort((a: LetterData, b: LetterData) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        // Get the most recent letter
        const lastLetter = sortedLetters[0];
        
        // Count unread letters in this thread
        const unreadCount = sortedLetters.filter((letter: LetterData) => 
          letter.recipient_id === user.id && !letter.is_read
        ).length;
        
        return {
          id: thread.id,
          title: thread.title,
          last_message: lastLetter.content.substring(0, 100) + (lastLetter.content.length > 100 ? '...' : ''),
          last_message_date: lastLetter.created_at,
          unread_count: unreadCount,
          participants: Array.from(thread.participants) as string[],
        };
      });
      
      setThreads(formattedThreads);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchThreads();
  };

  const handleThreadPress = (thread: Thread) => {
    // Navigate to the first letter in the thread
    navigation.navigate('LetterDetail', { letterId: thread.id });
  };

  const renderThreadItem = ({ item }: { item: Thread }) => (
    <Card 
      style={[styles.card, item.unread_count > 0 && styles.unreadCard]} 
      onPress={() => handleThreadPress(item)}
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
        data={threads}
        renderItem={renderThreadItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No correspondence found</Text>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('WriteLetter', {})}
              style={styles.writeButton}
            >
              Start a Conversation
            </Button>
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