import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Letter, LetterWithDetails } from '../types/database.types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const [letters, setLetters] = useState<LetterWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  
  // Number of letters to fetch at a time
  const LETTERS_LIMIT = 10;

  /**
   * Fetches letters based on the current filter settings
   * If showOnlyUnread is true, only fetches letters not authored by and not read by the current user
   */
  const fetchLetters = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        // If no user is logged in, just fetch all letters
        const { data, error } = await supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .order('created_at', { ascending: false })
          .limit(LETTERS_LIMIT);
          
        if (error) {
          console.error('Error fetching letters:', error);
          return;
        }
        
        setLetters(data as LetterWithDetails[]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Get all read letter IDs for the current user
      const { data: readData, error: readError } = await supabase
        .from('letter_reads')
        .select('letter_id')
        .eq('user_id', user.id);
      
      if (readError) {
        console.error('Error fetching read letters:', readError);
        return;
      }
      
      // Extract read letter IDs into an array
      const readLetterIds = readData ? readData.map(item => item.letter_id) : [];
      
      // Base query for letters
      let query = supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .is('parent_id', null) // Only get top-level letters, not replies
        .order('created_at', { ascending: false });
      
      if (showOnlyUnread) {
        // Filter out letters written by the user
        query = query.neq('author_id', user.id);
        
        // Filter out letters that have been read, if any exist
        if (readLetterIds.length > 0) {
          query = query.not('id', 'in', readLetterIds);
        }
      }
      
      // Limit the number of results
      query = query.limit(LETTERS_LIMIT);
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching letters:', error);
        return;
      }

      if (data) {
        // Mark letters as read or unread
        const lettersWithReadStatus = data.map(letter => ({
          ...letter,
          is_read: readLetterIds.includes(letter.id)
        }));
        
        setLetters(lettersWithReadStatus as LetterWithDetails[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  /**
   * Gets a specific number of unread letters not authored by the current user
   * @param limit Number of letters to fetch
   */
  const getUnreadLettersNotByUser = async (limit: number = LETTERS_LIMIT) => {
    if (!user) return [];
    
    try {
      // Get all read letter IDs for the current user
      const { data: readData, error: readError } = await supabase
        .from('letter_reads')
        .select('letter_id')
        .eq('user_id', user.id);
      
      if (readError) {
        console.error('Error fetching read letters:', readError);
        return [];
      }
      
      // Extract read letter IDs into an array
      const readLetterIds = readData ? readData.map(item => item.letter_id) : [];
      
      // Query for letters not authored by the user and not read by them
      let query = supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .is('parent_id', null) // Only get top-level letters, not replies
        .neq('author_id', user.id) // Not written by the current user
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // If the user has read any letters, exclude those from the results
      if (readLetterIds.length > 0) {
        query = query.not('id', 'in', readLetterIds);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching unread letters:', error);
        return [];
      }
      
      console.log(`Found ${data?.length || 0} unread letters not authored by user`);
      return data || [];
    } catch (error) {
      console.error('Error fetching unread letters:', error);
      return [];
    }
  };
  
  /**
   * Loads unread letters and updates the UI
   */
  const loadUnreadLetters = async () => {
    try {
      setLoading(true);
      const unreadLetters = await getUnreadLettersNotByUser();
      
      // Mark all as unread (since we know they're unread)
      const lettersWithReadStatus = unreadLetters.map(letter => ({
        ...letter,
        is_read: false
      }));
      
      setLetters(lettersWithReadStatus as LetterWithDetails[]);
    } catch (error) {
      console.error('Error loading unread letters:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (showOnlyUnread) {
      loadUnreadLetters();
    } else {
      fetchLetters();
    }
  }, [user, showOnlyUnread]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (showOnlyUnread) {
      loadUnreadLetters();
    } else {
      fetchLetters();
    }
  };

  const toggleUnreadFilter = () => {
    setShowOnlyUnread(!showOnlyUnread);
    // The appropriate fetch function will be called by useEffect when showOnlyUnread changes
  };

  const handleLetterPress = async (letter: LetterWithDetails) => {
    // Navigate to letter detail
    navigation.navigate('LetterDetail', { letterId: letter.id });

    // Mark letter as read if user is logged in and not the author
    if (user && !letter.is_read && letter.author_id !== user.id) {
      try {
        await supabase.from('letter_reads').insert([
          {
            user_id: user.id,
            letter_id: letter.id,
          },
        ]);
        
        // Update the letters list to mark this letter as read
        setLetters(prevLetters => 
          prevLetters.map(l => 
            l.id === letter.id ? { ...l, is_read: true } : l
          )
        );
      } catch (error) {
        console.error('Error marking letter as read:', error);
      }
    }
  };

  const renderLetterItem = ({ item }: { item: LetterWithDetails }) => (
    <Card 
      style={[styles.card, !item.is_read && styles.unreadCard]} 
      onPress={() => handleLetterPress(item)}
    >
      <Card.Content>
        <View style={styles.headerRow}>
          <Title>{item.title}</Title>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Paragraph numberOfLines={3}>{item.content}</Paragraph>
        <View style={styles.cardFooter}>
          <Chip icon="account" style={styles.chip}>{item.display_name}</Chip>
          <Chip icon="tag" style={styles.chip}>{item.category?.name}</Chip>
          <Text style={styles.date}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
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
      <View style={styles.headerContainer}>
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>
            {showOnlyUnread ? 'Showing unread letters' : 'Showing all letters'}
          </Text>
          <Button 
            mode={showOnlyUnread ? "contained" : "outlined"}
            onPress={toggleUnreadFilter}
            icon="filter"
            compact
          >
            {showOnlyUnread ? "Unread Only" : "All Letters"}
          </Button>
        </View>
      </View>
      
      <FlatList
        data={letters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {showOnlyUnread 
                ? "No unread letters found" 
                : "No letters found"}
            </Text>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('WriteLetter', {})}
              style={styles.writeButton}
            >
              Write a Letter
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
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6200ee',
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 12,
    flexWrap: 'wrap',
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
  headerContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 14,
    color: '#666',
  },
});

export default HomeScreen; 