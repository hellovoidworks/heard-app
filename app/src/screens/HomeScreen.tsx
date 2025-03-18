import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button, Badge, IconButton } from 'react-native-paper';
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const fetchUnreadLettersCount = async () => {
    if (!user) return 0;

    try {
      console.log('Fetching unread letters count');
      
      // Get the ids of all letters the user has read
      const { data: readData, error: readError } = await supabase
        .from('letter_reads')
        .select('letter_id')
        .eq('user_id', user.id);
      
      if (readError) {
        console.error('Error fetching read letters:', readError);
        return 0;
      }
      
      // Extract read letter IDs into an array
      const readLetterIds = readData ? readData.map(item => item.letter_id) : [];
      
      // Count all letters not written by the user and not read by them
      let query = supabase
        .from('letters')
        .select('id', { count: 'exact' })
        .is('parent_id', null) // Only top-level letters, not replies
        .neq('author_id', user.id); // Not written by the current user
      
      // If the user has read any letters, exclude those from the count
      if (readLetterIds.length > 0) {
        query = query.not('id', 'in', readLetterIds);
      }
      
      const { count, error: countError } = await query;
      
      if (countError) {
        console.error('Error counting unread letters:', countError);
        return 0;
      }
      
      console.log(`Found ${count} unread letters`);
      setUnreadCount(count || 0);
      return count || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  };

  const fetchLetters = async () => {
    try {
      setLoading(true);
      
      // Get all read letter IDs if the user is logged in
      let readLetterIds: string[] = [];
      if (user) {
        const { data: readData } = await supabase
          .from('letter_reads')
          .select('letter_id')
          .eq('user_id', user.id);
        
        readLetterIds = readData ? readData.map(item => item.letter_id) : [];
      }
      
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
      
      // If filtering by unread and user is logged in
      if (showOnlyUnread && user) {
        // Filter out letters written by the user
        query = query.neq('author_id', user.id);
        
        // Filter out letters that have been read, if any exist
        if (readLetterIds.length > 0) {
          query = query.not('id', 'in', readLetterIds);
        }
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching letters:', error);
        return;
      }

      if (data) {
        // Mark letters as read or unread
        if (user) {
          // We already have readLetterIds from above
          const lettersWithReadStatus = data.map(letter => ({
            ...letter,
            is_read: readLetterIds.includes(letter.id)
          }));
          
          setLetters(lettersWithReadStatus as LetterWithDetails[]);
        } else {
          setLetters(data as LetterWithDetails[]);
        }
        
        // Fetch unread letters count
        if (!showOnlyUnread) {
          // Only need to fetch count if we're not already showing only unread
          await fetchUnreadLettersCount();
        } else {
          // If showing only unread, we know the count is the number of letters
          setUnreadCount(data.length);
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
    fetchLetters();
    
    // Set up interval to refresh unread count periodically
    const interval = setInterval(() => {
      if (user) {
        fetchUnreadLettersCount();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [user, showOnlyUnread]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetters();
  };

  const toggleUnreadFilter = () => {
    setShowOnlyUnread(!showOnlyUnread);
    // fetchLetters will be called by the useEffect when showOnlyUnread changes
  };

  const handleLetterPress = async (letter: LetterWithDetails) => {
    // Navigate to letter detail
    navigation.navigate('LetterDetail', { letterId: letter.id });

    // Mark letter as read if user is logged in
    if (user && !letter.is_read) {
      try {
        await supabase.from('letter_reads').insert([
          {
            user_id: user.id,
            letter_id: letter.id,
          },
        ]);
        
        // Update the unread count
        fetchUnreadLettersCount();
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
        {unreadCount > 0 && (
          <Text style={styles.unreadText}>
            You have {unreadCount} unread letter{unreadCount !== 1 ? 's' : ''}
          </Text>
        )}
        
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
  unreadText: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#6200ee',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  filterLabel: {
    fontSize: 14,
    color: '#666',
  },
});

export default HomeScreen; 