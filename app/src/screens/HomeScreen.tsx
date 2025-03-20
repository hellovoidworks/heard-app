import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button, Banner } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Letter, LetterWithDetails } from '../types/database.types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { 
  getCurrentDeliveryWindow, 
  formatDeliveryWindow, 
  getTimeUntilNextWindow 
} from '../utils/deliveryWindow';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const [letters, setLetters] = useState<LetterWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<{ hours: number; minutes: number }>({ hours: 0, minutes: 0 });
  const [currentWindow, setCurrentWindow] = useState<{ start: Date, end: Date, isNewWindow: boolean }>({ 
    start: new Date(), 
    end: new Date(), 
    isNewWindow: false 
  });
  const [formattedWindow, setFormattedWindow] = useState('');
  const [anyLettersInWindow, setAnyLettersInWindow] = useState(false);

  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  
  // Number of letters to fetch initially and when loading more
  const INITIAL_LETTERS_LIMIT = 5;
  const MORE_LETTERS_LIMIT = 5;

  // Update the time until next window every minute
  useEffect(() => {
    const updateTimeUntilNext = () => {
      setTimeUntilNext(getTimeUntilNextWindow());
    };

    // Update now and set up interval
    updateTimeUntilNext();
    const interval = setInterval(updateTimeUntilNext, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, []);

  // Determine the current delivery window when the component mounts or user changes
  useEffect(() => {
    const updateWindowAndFetch = async () => {
      const window = getCurrentDeliveryWindow();
      setCurrentWindow(window);
      setFormattedWindow(formatDeliveryWindow(window.start, window.end));
      
      // Check if we've already set anyLettersInWindow for this window
      if (user) {
        const { data: existingDeliveries, error } = await supabase
          .from('letter_received')
          .select('id')
          .eq('user_id', user.id)
          .gte('received_at', window.start.toISOString())
          .lt('received_at', window.end.toISOString());
          
        if (error) {
          console.error('Error checking for existing deliveries:', error);
        } else {
          // If we already have letters in this window, set the flag
          setAnyLettersInWindow(existingDeliveries && existingDeliveries.length > 0);
        }
      }
    };
    
    updateWindowAndFetch();
  }, [user]);

  /**
   * Gets letters delivered in the current window
   * If no letters have been delivered yet in this window, delivers new ones
   */
  const getLettersForCurrentWindow = async () => {
    if (!user) return [];
    
    try {
      // First, check if there are any letters already delivered in the current window
      const { data: existingDeliveries, error: deliveryError } = await supabase
        .from('letter_received')
        .select('letter_id, display_order')
        .eq('user_id', user.id)
        .gte('received_at', currentWindow.start.toISOString())
        .lt('received_at', currentWindow.end.toISOString())
        .order('display_order', { ascending: true });
      
      if (deliveryError) {
        console.error('Error checking for existing deliveries:', deliveryError);
        return [];
      }
      
      // If we already have letters delivered in this window, fetch and return them
      if (existingDeliveries && existingDeliveries.length > 0) {
        console.log(`Found ${existingDeliveries.length} letters already delivered in this window`);
        setAnyLettersInWindow(true);
        
        // Create a map of letter ID to display order for later sorting
        const letterDisplayOrders = new Map<string, number>();
        existingDeliveries.forEach(delivery => {
          letterDisplayOrders.set(delivery.letter_id, delivery.display_order);
        });
        
        const letterIds = existingDeliveries.map(delivery => delivery.letter_id);
        
        const { data: letters, error: lettersError } = await supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .in('id', letterIds);
        
        if (lettersError) {
          console.error('Error fetching delivered letters:', lettersError);
          return [];
        }
        
        // Get read status for these letters
        const { data: readData, error: readError } = await supabase
          .from('letter_reads')
          .select('letter_id')
          .eq('user_id', user.id)
          .in('letter_id', letterIds);
          
        if (readError) {
          console.error('Error fetching read status:', readError);
        }
        
        // Convert read data to a Set for faster lookups
        const readLetterIds = new Set(readData ? readData.map(item => item.letter_id) : []);
        
        // Add read status to each letter
        const lettersWithReadStatus = letters ? letters.map(letter => ({
          ...letter,
          is_read: readLetterIds.has(letter.id),
          display_order: letterDisplayOrders.get(letter.id) || 0
        })) : [];
        
        // Sort by display_order to maintain consistent order (higher values at the top)
        lettersWithReadStatus.sort((a, b) => (b.display_order || 0) - (a.display_order || 0));
        
        return lettersWithReadStatus;
      } else {
        // No letters delivered in this window yet, deliver new ones and store them
        console.log('No letters delivered in this window yet, fetching new ones');
        setAnyLettersInWindow(false);
        
        // Check if this is a new window we just entered
        if (currentWindow.isNewWindow) {
          console.log('New delivery window detected, delivering fresh letters');
          const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
          return newLetters.map(letter => ({
            ...letter,
            is_read: false
          }));
        } else {
          // If it's not a new window but we don't have letters, it might be due to
          // the app being force closed or cleared from memory. Let's not deliver
          // new letters automatically in this case to avoid too many letters.
          console.log('Not a new window but no letters found, returning empty set');
          return [];
        }
      }
    } catch (error) {
      console.error('Error getting letters for current window:', error);
      return [];
    }
  };

  /**
   * Gets a specific number of unread letters not authored by the current user
   * Returns random letters from all categories, prioritizing preferred categories
   * @param limit Number of letters to fetch
   */
  const getUnreadLettersNotByUser = async (limit: number = INITIAL_LETTERS_LIMIT) => {
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
      
      // Also get all letters already received by this user in any window
      const { data: receivedData, error: receivedError } = await supabase
        .from('letter_received')
        .select('letter_id')
        .eq('user_id', user.id);
        
      if (receivedError) {
        console.error('Error fetching previously received letters:', receivedError);
      }
      
      // Extract previously received letter IDs
      const receivedLetterIds = receivedData ? receivedData.map(item => item.letter_id) : [];
      
      // If user has preferences, first try to get unread letters from preferred categories
      let resultLetters: any[] = [];
      
      if (preferredCategoryIds.length > 0) {
        // Query for random unread letters from preferred categories
        const query = supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .neq('author_id', user.id); // Not written by the current user
        
        // Filter by preferred categories
        query.in('category_id', preferredCategoryIds);
        
        // If the user has read any letters, exclude those from the results
        if (readLetterIds.length > 0) {
          query.filter('id', 'not.in', `(${readLetterIds.join(',')})`);
        }
        
        // If the user has received any letters in previous windows, prioritize new content
        if (receivedLetterIds.length > 0) {
          // First try to get only letters that haven't been received before
          const { data: newLetters, error: newLettersError } = await query
            .filter('id', 'not.in', `(${receivedLetterIds.join(',')})`)
            .order('created_at', { ascending: Math.random() > 0.5 })
            .limit(limit);
            
          if (newLettersError) {
            console.error('Error fetching new preferred letters:', newLettersError);
          } else if (newLetters && newLetters.length > 0) {
            console.log(`Found ${newLetters.length} new unread letters from preferred categories`);
            resultLetters = newLetters;
          }
          
          // If we didn't get enough new letters, fill in with previously received ones
          if (resultLetters.length < limit) {
            const remainingLimit = limit - resultLetters.length;
            console.log(`Fetching ${remainingLimit} more letters from previously received`);
            
            const { data: oldLetters, error: oldLettersError } = await query
              .filter('id', 'in', `(${receivedLetterIds.join(',')})`)
              .order('created_at', { ascending: Math.random() > 0.5 })
              .limit(remainingLimit);
              
            if (oldLettersError) {
              console.error('Error fetching old preferred letters:', oldLettersError);
            } else if (oldLetters) {
              resultLetters = [...resultLetters, ...oldLetters];
            }
          }
        } else {
          // User hasn't received any letters yet, so just get random ones
          const { data: preferredLetters, error: preferredError } = await query
            .order('created_at', { ascending: Math.random() > 0.5 })
            .limit(limit);
          
          if (preferredError) {
            console.error('Error fetching preferred category letters:', preferredError);
          } else if (preferredLetters) {
            console.log(`Found ${preferredLetters.length} unread letters from preferred categories`);
            resultLetters = preferredLetters;
          }
        }
      }
      
      // If we didn't get enough letters from preferred categories, get more from any category
      if (resultLetters.length < limit) {
        const remainingLimit = limit - resultLetters.length;
        
        // Need to exclude IDs of letters we already have
        const excludeIds = [...readLetterIds, ...resultLetters.map(letter => letter.id)];
        
        // Query for remaining random unread letters from any category
        const query = supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .neq('author_id', user.id); // Not written by the current user
        
        // If we have any IDs to exclude, do so
        if (excludeIds.length > 0) {
          query.filter('id', 'not.in', `(${excludeIds.join(',')})`);
        }
        
        // Exclude preferred categories since we already queried those
        if (preferredCategoryIds.length > 0) {
          query.filter('category_id', 'not.in', `(${preferredCategoryIds.join(',')})`);
        }
        
        // First try to get letters that haven't been received before
        if (receivedLetterIds.length > 0) {
          const { data: newAdditionalLetters, error: newAdditionalError } = await query
            .filter('id', 'not.in', `(${receivedLetterIds.join(',')})`)
            .order('created_at', { ascending: Math.random() > 0.5 })
            .limit(remainingLimit);
            
          if (newAdditionalError) {
            console.error('Error fetching new additional letters:', newAdditionalError);
          } else if (newAdditionalLetters && newAdditionalLetters.length > 0) {
            console.log(`Found ${newAdditionalLetters.length} new additional letters`);
            resultLetters = [...resultLetters, ...newAdditionalLetters];
          }
          
          // If we still need more, get previously received ones
          if (resultLetters.length < limit) {
            const finalLimit = limit - resultLetters.length;
            const { data: oldAdditionalLetters, error: oldAdditionalError } = await query
              .filter('id', 'in', `(${receivedLetterIds.join(',')})`)
              .order('created_at', { ascending: Math.random() > 0.5 })
              .limit(finalLimit);
              
            if (oldAdditionalError) {
              console.error('Error fetching old additional letters:', oldAdditionalError);
            } else if (oldAdditionalLetters) {
              resultLetters = [...resultLetters, ...oldAdditionalLetters];
            }
          }
        } else {
          // User hasn't received any letters yet
          const { data: additionalLetters, error: additionalError } = await query
            .order('created_at', { ascending: Math.random() > 0.5 })
            .limit(remainingLimit);
          
          if (additionalError) {
            console.error('Error fetching additional letters:', additionalError);
          } else if (additionalLetters) {
            console.log(`Found ${additionalLetters.length} additional unread letters`);
            resultLetters = [...resultLetters, ...additionalLetters];
          }
        }
      }
      
      // Track which letters were received by the user
      if (resultLetters.length > 0 && user) {
        try {
          // Create letter_received entries for each letter with display_order
          // Start with a high value to ensure consistency with other functions
          const baseOrder = 1000;
          const letterReceivedEntries = resultLetters.map((letter, index) => ({
            user_id: user.id,
            letter_id: letter.id,
            received_at: new Date().toISOString(),
            // Using descending display_order (latest first) - higher index = higher priority
            display_order: baseOrder + (resultLetters.length - index - 1)
          }));
          
          // Insert the records
          const { error: insertError } = await supabase
            .from('letter_received')
            .upsert(letterReceivedEntries, { 
              onConflict: 'user_id,letter_id', 
              ignoreDuplicates: false // Changed to false to update display_order if needed
            });
          
          if (insertError) {
            console.error('Error tracking received letters:', insertError);
          } else {
            console.log(`Tracked ${letterReceivedEntries.length} letters as received by user`);
            setAnyLettersInWindow(true);
          }
        } catch (trackError) {
          console.error('Error tracking received letters:', trackError);
        }
      }
      
      console.log(`Returning total of ${resultLetters.length} random unread letters`);
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
        // If no user is logged in, just fetch random letters
        const { data, error } = await supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .is('parent_id', null) // Only get top-level letters, not replies
          .order('created_at', { ascending: Math.random() > 0.5 }) // Random order
          .limit(INITIAL_LETTERS_LIMIT);
          
        if (error) {
          console.error('Error fetching letters:', error);
          return;
        }
        
        setLetters(data as LetterWithDetails[]);
        return;
      }
      
      // Get letters for the current delivery window
      const windowLetters = await getLettersForCurrentWindow();
      
      if (windowLetters.length === 0 && !currentWindow.isNewWindow) {
        // If we don't have letters and it's not a new window,
        // we'll show a special empty state where the user can manually get letters
        console.log('No letters in current window and not a new window');
      }
      
      setLetters(windowLetters as LetterWithDetails[]);
      console.log(`Loaded ${windowLetters.length} letters for current window`);
      
    } catch (error) {
      console.error('Error loading initial letters:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  /**
   * Loads more random letters when the user presses the "Load More" button
   */
  const loadMoreLetters = async () => {
    if (loadingMore || !user) return;
    
    try {
      setLoadingMore(true);
      
      // Calculate display order for new letters - use values higher than current max
      // to ensure new letters appear at the top
      let maxDisplayOrder = 0;
      if (letters.length > 0) {
        // Find the highest current display_order value
        maxDisplayOrder = Math.max(...letters.map(letter => letter.display_order || 0)) + 1000; 
        // Add a big increment to ensure new letters have higher values
      }
      
      // Fetch more random unread letters
      const moreLetters = await getUnreadLettersNotByUser(MORE_LETTERS_LIMIT);
      
      if (moreLetters.length === 0) {
        console.log('No more unread letters available');
        return;
      }
      
      // Create letter_received entries for each additional letter with higher display_order
      // so they appear at the top
      const letterReceivedEntries = moreLetters.map((letter, index) => ({
        user_id: user.id,
        letter_id: letter.id,
        received_at: new Date().toISOString(),
        display_order: maxDisplayOrder + index // Higher values to appear at the top
      }));
      
      // Insert the records
      const { error: insertError } = await supabase
        .from('letter_received')
        .upsert(letterReceivedEntries, { 
          onConflict: 'user_id,letter_id', 
          ignoreDuplicates: false // Update display_order if entry exists
        });
      
      if (insertError) {
        console.error('Error tracking received letters:', insertError);
      }
      
      // Mark all as unread and add display_order
      const moreWithReadStatus = moreLetters.map((letter, index) => ({
        ...letter,
        is_read: false,
        display_order: maxDisplayOrder + index
      }));
      
      // Prepend to the existing letters
      setLetters(prevLetters => [...moreWithReadStatus, ...prevLetters] as LetterWithDetails[]);
      
      console.log(`Loaded ${moreLetters.length} more letters at the top`);
    } catch (error) {
      console.error('Error loading more letters:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Force fetches new letters for this window, 
   * even if it's not a new window
   */
  const forceDeliverLetters = async () => {
    try {
      setLoading(true);
      
      // Get new unread letters
      const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
      
      // Calculate a high display order to ensure new letters appear at the top
      const baseOrder = 2000; // Even higher than regular letters
      
      // Add read status and display_order (higher values first)
      const lettersWithReadStatus = newLetters.map((letter, index) => ({
        ...letter,
        is_read: false,
        display_order: baseOrder + (newLetters.length - index - 1)
      }));
      
      // Update state
      setLetters(lettersWithReadStatus as LetterWithDetails[]);
      console.log(`Forcefully delivered ${newLetters.length} new letters`);
      
    } catch (error) {
      console.error('Error forcing letter delivery:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialLetters();
  }, [user, currentWindow]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Update window and then load letters
    const window = getCurrentDeliveryWindow();
    setCurrentWindow(window);
    setFormattedWindow(formatDeliveryWindow(window.start, window.end));
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

  const renderNextWindowInfo = () => {
    if (!user) return null;

    return (
      <Banner
        visible={true}
        actions={[]}
        icon="clock-outline"
        style={styles.banner}
      >
        <Text style={styles.bannerTitle}>Letters for {formattedWindow}</Text>
        <Text style={styles.bannerText}>
          Next batch in {timeUntilNext.hours}h {timeUntilNext.minutes}m
        </Text>
      </Banner>
    );
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
      {renderNextWindowInfo()}
      <FlatList
        data={letters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {user 
                ? (anyLettersInWindow 
                    ? "No more letters available in this window" 
                    : currentWindow.isNewWindow
                      ? "No letters available for this window yet"
                      : "No letters found for this time window")
                : "No letters found"}
            </Text>
            
            {user && !anyLettersInWindow && !currentWindow.isNewWindow ? (
              <>
                <Text style={styles.emptySubText}>
                  You haven't received any letters in this time window.
                </Text>
                <Button 
                  mode="contained" 
                  onPress={forceDeliverLetters}
                  style={styles.actionButton}
                  icon="mail"
                >
                  Deliver Letters Now
                </Button>
                <View style={styles.buttonSpacer} />
              </>
            ) : null}
            
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('WriteLetter', {})}
              style={styles.writeButton}
              icon="pencil"
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
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
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
  banner: {
    marginBottom: 8,
  },
  bannerTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 14,
  },
  actionButton: {
    marginBottom: 10,
  },
  buttonSpacer: {
    width: 10,
  },
});

export default HomeScreen; 