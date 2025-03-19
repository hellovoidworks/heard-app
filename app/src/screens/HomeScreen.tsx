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
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  
  // Number of letters to fetch initially and when loading more
  const INITIAL_LETTERS_LIMIT = 5;
  const MORE_LETTERS_LIMIT = 5;

  /**
   * Gets a specific number of unread letters not authored by the current user
   * Prioritizes letters from categories the user has expressed interest in
   * @param limit Number of letters to fetch
   * @param offset Number of letters to skip (for pagination)
   */
  const getUnreadLettersNotByUser = async (limit: number = INITIAL_LETTERS_LIMIT, offset: number = 0) => {
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
      
      // Get user's category preferences
      const { data: categoryPreferences, error: preferencesError } = await supabase
        .from('user_category_preferences')
        .select('category_id')
        .eq('user_id', user.id);
        
      if (preferencesError) {
        console.error('Error fetching category preferences:', preferencesError);
        // Continue without preferences rather than failing
      }
      
      // Extract preferred category IDs
      const preferredCategoryIds = categoryPreferences 
        ? categoryPreferences.map(pref => pref.category_id) 
        : [];
      
      console.log(`User has ${preferredCategoryIds.length} preferred categories`);
      
      // If user has preferences, first try to get unread letters from preferred categories
      let resultLetters: any[] = [];
      
      if (preferredCategoryIds.length > 0) {
        // Query for unread letters from preferred categories
        const query = supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .neq('author_id', user.id) // Not written by the current user
          .in('category_id', preferredCategoryIds) // From preferred categories
          .order('created_at', { ascending: true }) // Changed to ascending for oldest first
          .range(offset, offset + limit - 1);
        
        // If the user has read any letters, exclude those from the results
        if (readLetterIds.length > 0) {
          query.filter('id', 'not.in', `(${readLetterIds.join(',')})`);
        }
        
        const { data: preferredLetters, error: preferredError } = await query;
        
        if (preferredError) {
          console.error('Error fetching preferred category letters:', preferredError);
        } else if (preferredLetters) {
          console.log(`Found ${preferredLetters.length} unread letters from preferred categories`);
          resultLetters = preferredLetters;
        }
      }
      
      // If we didn't get enough letters from preferred categories, get more from any category
      if (resultLetters.length < limit) {
        const remainingLimit = limit - resultLetters.length;
        const remainingOffset = Math.max(0, offset - resultLetters.length);
        
        // Need to exclude IDs of letters we already have
        const excludeIds = [...readLetterIds, ...resultLetters.map(letter => letter.id)];
        
        // Query for remaining unread letters from any category
        const query = supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .neq('author_id', user.id) // Not written by the current user
          .order('created_at', { ascending: true }) // Changed to ascending for oldest first
          .range(remainingOffset, remainingOffset + remainingLimit - 1);
        
        // If we have any IDs to exclude, do so
        if (excludeIds.length > 0) {
          query.filter('id', 'not.in', `(${excludeIds.join(',')})`);
        }
        
        // Exclude preferred categories since we already queried those
        if (preferredCategoryIds.length > 0) {
          query.filter('category_id', 'not.in', `(${preferredCategoryIds.join(',')})`);
        }
        
        const { data: additionalLetters, error: additionalError } = await query;
        
        if (additionalError) {
          console.error('Error fetching additional letters:', additionalError);
        } else if (additionalLetters) {
          console.log(`Found ${additionalLetters.length} additional unread letters from other categories`);
          resultLetters = [...resultLetters, ...additionalLetters];
        }
      }
      
      console.log(`Returning total of ${resultLetters.length} unread letters`);
      return resultLetters;
      
    } catch (error) {
      console.error('Error fetching unread letters:', error);
      return [];
    }
  };
  
  /**
   * Loads initial letters when the component mounts
   */
  const loadInitialLetters = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        // If no user is logged in, just fetch recent letters
        const { data, error } = await supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .order('created_at', { ascending: true }) // Changed to ascending for oldest first
          .limit(INITIAL_LETTERS_LIMIT);
          
        if (error) {
          console.error('Error fetching letters:', error);
          return;
        }
        
        setLetters(data as LetterWithDetails[]);
        return;
      }
      
      // Get unread letters for logged in user
      const unreadLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
      
      // Mark all as unread (since we know they're unread)
      const lettersWithReadStatus = unreadLetters.map(letter => ({
        ...letter,
        is_read: false
      }));
      
      setLetters(lettersWithReadStatus as LetterWithDetails[]);
      console.log(`Loaded ${unreadLetters.length} initial letters`);
      
    } catch (error) {
      console.error('Error loading initial letters:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  /**
   * Loads more letters when the user presses the "Load More" button
   */
  const loadMoreLetters = async () => {
    if (loadingMore || !user) return;
    
    try {
      setLoadingMore(true);
      
      // Calculate the offset based on current letters
      const offset = letters.length;
      
      // Fetch more unread letters
      const moreLetters = await getUnreadLettersNotByUser(MORE_LETTERS_LIMIT, offset);
      
      if (moreLetters.length === 0) {
        console.log('No more unread letters available');
        return;
      }
      
      // Mark all as unread
      const moreWithReadStatus = moreLetters.map(letter => ({
        ...letter,
        is_read: false
      }));
      
      // Append to the existing letters
      setLetters(prevLetters => [...prevLetters, ...moreWithReadStatus] as LetterWithDetails[]);
      
      console.log(`Loaded ${moreLetters.length} more letters`);
    } catch (error) {
      console.error('Error loading more letters:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitialLetters();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadInitialLetters();
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

  const renderHeader = () => {
    if (!user || letters.length === 0) return null;
    
    return (
      <View style={styles.headerContainer}>
        <Button 
          mode="outlined"
          onPress={loadMoreLetters}
          loading={loadingMore}
          disabled={loadingMore}
          icon="refresh"
          style={styles.loadMoreButton}
        >
          Load More Letters
        </Button>
      </View>
    );
  };

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
        data={letters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {user 
                ? "No unread letters in your preferred categories yet" 
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
    paddingBottom: 24,
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
    marginBottom: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    width: '80%',
  },
});

export default HomeScreen; 