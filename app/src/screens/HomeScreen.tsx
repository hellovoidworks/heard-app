import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Animated, Easing, Alert } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Button, Banner, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails } from '../types/database.types';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { 
  getCurrentDeliveryWindow, 
  formatDeliveryWindow, 
  getTimeUntilNextWindow 
} from '../utils/deliveryWindow';
import { StorageService, STORAGE_KEYS } from '../services/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Add timeout utility
const timeoutPromise = (promise: Promise<any>, timeoutMs: number) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

const HomeScreen = () => {
  const [letters, setLetters] = useState<LetterWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user, profile, updateStars } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const [timeUntilNext, setTimeUntilNext] = useState<{ hours: number; minutes: number; seconds: number }>({ 
    hours: 0, 
    minutes: 0,
    seconds: 0
  });
  const [currentWindow, setCurrentWindow] = useState<{ start: Date, end: Date, isNewWindow: boolean }>({ 
    start: new Date(), 
    end: new Date(), 
    isNewWindow: false 
  });
  const [formattedWindow, setFormattedWindow] = useState('');
  const [anyLettersInWindow, setAnyLettersInWindow] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [animatingLetterIds, setAnimatingLetterIds] = useState<Set<string>>(new Set());

  // Number of letters to fetch initially and when loading more
  const INITIAL_LETTERS_LIMIT = 5;
  const MORE_LETTERS_LIMIT = 1;

  // Create a map to store animation values for each letter
  const fadeAnims = useMemo(() => new Map<string, Animated.Value>(), []);

  const getLetterAnimation = useCallback((letterId: string) => {
    if (!fadeAnims.has(letterId) && animatingLetterIds.has(letterId)) {
      const fadeAnim = new Animated.Value(0);
      fadeAnims.set(letterId, fadeAnim);
      // Start the animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // Remove the letter from animating set when animation is done
        setAnimatingLetterIds(prev => {
          const next = new Set(prev);
          next.delete(letterId);
          return next;
        });
      });
    }
    return fadeAnims.get(letterId) || new Animated.Value(1);
  }, [animatingLetterIds]);

  // Update the time until next window every second
  useEffect(() => {
    const updateTimeUntilNext = () => {
      setTimeUntilNext(getTimeUntilNextWindow());
    };

    // Update now and set up interval
    updateTimeUntilNext();
    const interval = setInterval(updateTimeUntilNext, 1000); // Update every second
    
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
   * Saves letters to storage with their delivery window timestamp
   */
  const saveLettersToStorage = async (lettersToSave: LetterWithDetails[]) => {
    if (!user) return;
    
    try {
      const receivedTime = new Date().toISOString();
      StorageService.setItem(STORAGE_KEYS.HOME_LETTERS, lettersToSave, user.id);
      StorageService.setItem(STORAGE_KEYS.LETTER_RECEIVED_TIME, receivedTime, user.id);
      
      // Get fresh delivery window to ensure we have the latest values
      const deliveryWindow = getCurrentDeliveryWindow();
      
      console.log('Saving letters to storage:', {
        userId: user.id,
        letterCount: lettersToSave.length,
        receivedTime,
        currentWindowStart: deliveryWindow.start.toISOString(),
        currentWindowEnd: deliveryWindow.end.toISOString()
      });
    } catch (error) {
      console.error('Error saving letters to storage:', error);
    }
  };

  /**
   * Loads letters from storage and validates if they are still valid for the current window
   */
  const loadLettersFromStorage = async (): Promise<{letters: LetterWithDetails[] | null, isCurrentWindow: boolean}> => {
    if (!user) {
      return { letters: null, isCurrentWindow: false };
    }

    try {
      const storedLetters = StorageService.getItem(STORAGE_KEYS.HOME_LETTERS, user.id);
      const receivedTimeStr = StorageService.getItem(STORAGE_KEYS.LETTER_RECEIVED_TIME, user.id);
      
      if (!storedLetters || !receivedTimeStr) {
        console.log('No letters found in storage for user', user.id);
        return { letters: null, isCurrentWindow: false };
      }
      
      const receivedTime = new Date(receivedTimeStr);
      
      // Get fresh delivery window to ensure we have the latest values
      const deliveryWindow = getCurrentDeliveryWindow();
      const isCurrentWindow = receivedTime >= deliveryWindow.start && receivedTime < deliveryWindow.end;
      
      console.log('Loading letters from storage:', {
        userId: user.id,
        letterCount: storedLetters.length,
        storedReceivedTime: receivedTime.toISOString(),
        currentWindowStart: deliveryWindow.start.toISOString(),
        currentWindowEnd: deliveryWindow.end.toISOString(),
        isCurrentWindow
      });
      
      return { 
        letters: storedLetters, 
        isCurrentWindow 
      };
    } catch (error) {
      console.error('Error loading letters from storage:', error);
      return { letters: null, isCurrentWindow: false };
    }
  };

  /**
   * Clears letters from storage
   */
  const clearStoredLetters = async () => {
    if (!user) return;

    try {
      StorageService.removeItem(STORAGE_KEYS.HOME_LETTERS, user.id);
      StorageService.removeItem(STORAGE_KEYS.LETTER_RECEIVED_TIME, user.id);
      console.log('Cleared stored letters from storage for user', user.id);
    } catch (error) {
      console.error('Error clearing letters from storage:', error);
    }
  };

  /**
   * Updates read status for a letter in storage
   */
  const updateLetterReadStatusInStorage = async (letterId: string, isRead: boolean) => {
    if (!user) return;

    try {
      const storedLetters = StorageService.getItem(STORAGE_KEYS.HOME_LETTERS, user.id) as LetterWithDetails[];
      if (!storedLetters) return;
      
      const updatedLetters = storedLetters.map((letter: LetterWithDetails) => 
        letter.id === letterId ? { ...letter, is_read: isRead } : letter
      );
      
      StorageService.setItem(STORAGE_KEYS.HOME_LETTERS, updatedLetters, user.id);
      console.log(`Updated read status for letter ${letterId} in storage for user ${user.id}`);
    } catch (error) {
      console.error('Error updating letter read status in storage:', error);
    }
  };

  /**
   * Gets letters delivered in the current window
   * If no letters have been delivered yet in this window, delivers new ones
   */
  const getLettersForCurrentWindow = async () => {
    if (!user) return [];
    
    try {
      console.log('DEBUG: getLettersForCurrentWindow - Start');
      
      // First, check if there are any letters already delivered in the current window
      console.log('DEBUG: Checking for existing deliveries in current window:', 
        currentWindow.start.toISOString(), 'to', currentWindow.end.toISOString());
      
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
      
      console.log('DEBUG: existingDeliveries query completed', existingDeliveries?.length || 0);
      
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
        
        console.log('DEBUG: Fetching letters with IDs:', letterIds);
        
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
        
        console.log('DEBUG: Letters query returned', letters?.length || 0, 'letters');
        
        // Get read status for these letters
        console.log('DEBUG: Checking read status for letters');
        const { data: readData, error: readError } = await supabase
          .from('letter_reads')
          .select('letter_id')
          .eq('user_id', user.id)
          .in('letter_id', letterIds);
          
        if (readError) {
          console.error('Error fetching read status:', readError);
        }
        
        console.log('DEBUG: Read status query completed');
        
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
        
        console.log('DEBUG: Returning', lettersWithReadStatus.length, 'letters with read status');
        return lettersWithReadStatus;
      } else {
        // No letters delivered in this window yet, deliver new ones and store them
        console.log('No letters delivered in this window yet, fetching new ones');
        setAnyLettersInWindow(false);
        
        // Check if this is a new window we just entered
        if (currentWindow.isNewWindow) {
          console.log('New delivery window detected, delivering fresh letters');
          console.log('DEBUG: Calling getUnreadLettersNotByUser');
          const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
          console.log('DEBUG: getUnreadLettersNotByUser returned', newLetters?.length || 0, 'letters');
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
    console.log('DEBUG: getUnreadLettersNotByUser - Start', limit);
    
    if (!user) return [];
    
    try {
      // Get all read letter IDs for the current user
      console.log('DEBUG: Fetching read letters');
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
      console.log(`DEBUG: User has read ${readLetterIds.length} letters`);
      
      // Get user's category preferences
      console.log('DEBUG: Fetching category preferences');
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
      console.log('DEBUG: Fetching previously received letters');
      const { data: receivedData, error: receivedError } = await supabase
        .from('letter_received')
        .select('letter_id')
        .eq('user_id', user.id);
        
      if (receivedError) {
        console.error('Error fetching previously received letters:', receivedError);
      }
      
      // Extract previously received letter IDs
      const receivedLetterIds = receivedData ? receivedData.map(item => item.letter_id) : [];
      console.log(`DEBUG: User has received ${receivedLetterIds.length} letters previously`);
      
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
          .neq('author_id', user.id); // Not written by the current user
        
        // Filter by preferred categories
        query.in('category_id', preferredCategoryIds);
        
        // If the user has read any letters, exclude those from the results
        if (readLetterIds.length > 0) {
          // FIX: Use a safer approach for larger arrays
          if (readLetterIds.length > 100) {
            // If there are too many read letters, just fetch a large sample and filter in memory
            console.log('DEBUG: Too many read letters, using simplified query');
            const { data: allLetters, error: allLettersError } = await query
              .order('created_at', { ascending: false })
              .limit(100);
              
            if (allLettersError) {
              console.error('Error fetching letters with simplified query:', allLettersError);
            } else if (allLetters) {
              const filteredLetters = allLetters.filter(letter => !readLetterIds.includes(letter.id));
              resultLetters = filteredLetters.slice(0, limit);
            }
          } else {
            query.filter('id', 'not.in', `(${readLetterIds.join(',')})`);
          }
        }
        
        // If we didn't get letters with the simplified approach, and there aren't too many received letters
        if (resultLetters.length === 0 && receivedLetterIds.length <= 100) {
          // If the user has received any letters in previous windows, prioritize new content
          console.log('DEBUG: Fetching new preferred letters not previously received');
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
          if (resultLetters.length < limit && receivedLetterIds.length > 0) {
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
        } else if (resultLetters.length === 0) {
          // User hasn't received any letters yet, so just get random ones
          console.log('DEBUG: Fetching random preferred letters');
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
        // FIX: Just get a few random letters as a fallback to avoid complex queries
        console.log('DEBUG: Fetching fallback letters');
        
        const { data: fallbackLetters, error: fallbackError } = await supabase
          .from('letters')
          .select(`
            *,
            category:categories(*),
            author:user_profiles!letters_author_id_fkey(*)
          `)
          .neq('author_id', user.id) // Not written by the current user
          .order('created_at', { ascending: false })
          .limit(limit - resultLetters.length);
          
        if (fallbackError) {
          console.error('Error fetching fallback letters:', fallbackError);
        } else if (fallbackLetters) {
          // Filter out any letters we already have
          const existingIds = new Set(resultLetters.map(letter => letter.id));
          const newFallbackLetters = fallbackLetters.filter(letter => !existingIds.has(letter.id));
          
          console.log(`Found ${newFallbackLetters.length} fallback letters`);
          resultLetters = [...resultLetters, ...newFallbackLetters];
        }
      }
      
      // Track which letters were received by the user
      if (resultLetters.length > 0 && user) {
        try {
          console.log('DEBUG: Tracking letters as received');
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
      
      console.log(`DEBUG: getUnreadLettersNotByUser - Returning ${resultLetters.length} letters`);
      return resultLetters;
      
    } catch (error) {
      console.error('Error fetching unread letters:', error);
      return [];
    }
  };
  
  /**
   * A simplified method to get letters
   * This is used as a fallback when the main method times out
   */
  const getSimpleLetters = async (limit: number = INITIAL_LETTERS_LIMIT) => {
    if (!user) return [];
    
    try {
      console.log('DEBUG: Using simplified letter fetching method');
      
      // Simple query to get the most recent letters without complex filtering
      const { data: letters, error } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .neq('author_id', user.id) // Not written by the current user
        .order('created_at', { ascending: false }) // Get newest first
        .limit(limit);
      
      if (error) {
        console.error('Error fetching simple letters:', error);
        return [];
      }
      
      if (!letters || letters.length === 0) {
        console.log('No letters found with simplified query');
        return [];
      }
      
      console.log(`Found ${letters.length} letters with simplified query`);
      
      // Get read status for these letters
      const letterIds = letters.map(letter => letter.id);
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
      const lettersWithReadStatus = letters.map(letter => ({
        ...letter,
        is_read: readLetterIds.has(letter.id),
        display_order: 0 // Default display order
      }));
      
      // Track which letters were received by the user
      if (lettersWithReadStatus.length > 0) {
        try {
          // Create letter_received entries for each letter
          const baseOrder = 1000;
          const letterReceivedEntries = lettersWithReadStatus.map((letter, index) => ({
            user_id: user.id,
            letter_id: letter.id,
            received_at: new Date().toISOString(),
            display_order: baseOrder + (lettersWithReadStatus.length - index - 1)
          }));
          
          // Insert the records
          const { error: insertError } = await supabase
            .from('letter_received')
            .upsert(letterReceivedEntries, { 
              onConflict: 'user_id,letter_id', 
              ignoreDuplicates: false 
            });
          
          if (insertError) {
            console.error('Error tracking received letters in simple method:', insertError);
          } else {
            console.log(`Tracked ${letterReceivedEntries.length} letters as received`);
            setAnyLettersInWindow(true);
          }
        } catch (trackError) {
          console.error('Error tracking received letters in simple method:', trackError);
        }
      }
      
      return lettersWithReadStatus;
    } catch (error) {
      console.error('Error in simplified letter fetching:', error);
      return [];
    }
  };

  /**
   * Loads initial letters when the component mounts
   */
  const loadInitialLetters = async () => {
    console.log('Loading initial letters');
    
    if (!user) {
      console.log('No user found, deferring letter loading');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setLoadError(null);
      
      // First check local storage for cached letters
      const { letters: storedLetters, isCurrentWindow } = await loadLettersFromStorage();
      
      // If we have valid letters from the current window, use them
      if (storedLetters && storedLetters.length > 0 && isCurrentWindow) {
        console.log('Using stored letters from current delivery window');
        setLetters(storedLetters);
        setLoading(false);
        return;
      } else if (storedLetters && !isCurrentWindow) {
        // If letters exist but from a previous window, clear them
        console.log('Clearing stored letters from previous delivery window');
        await clearStoredLetters();
      }
      
      console.log('DEBUG: Calling getLettersForCurrentWindow with timeout...');
      
      try {
        // Set a 10-second timeout for this operation
        const fetchedLetters = await timeoutPromise(getLettersForCurrentWindow(), 10000);
        
        console.log('DEBUG: getLettersForCurrentWindow returned', fetchedLetters?.length || 0, 'letters');
        
        if (fetchedLetters && fetchedLetters.length > 0) {
          console.log(`Loaded ${fetchedLetters.length} letters successfully`);
          setLetters(fetchedLetters);
          // Save fetched letters to local storage
          await saveLettersToStorage(fetchedLetters);
        } else {
          console.log('No letters available to display, delivering new letters automatically');
          // Automatically deliver new letters if none exist
          const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
          if (newLetters && newLetters.length > 0) {
            console.log(`Delivered ${newLetters.length} new letters automatically`);
            
            // Add new letters to animating set for animation
            setAnimatingLetterIds(prev => {
              const next = new Set(prev);
              newLetters.forEach(letter => next.add(letter.id));
              return next;
            });
            
            const newLettersWithReadStatus = newLetters.map(letter => ({
              ...letter,
              is_read: false
            }));
            
            setLetters(newLettersWithReadStatus);
            setAnyLettersInWindow(true);
            
            // Save the new letters to local storage
            await saveLettersToStorage(newLettersWithReadStatus);
          } else {
            console.log('No new letters available to deliver');
            setLetters([]);
          }
        }
      } catch (timeoutError) {
        console.error('Letters loading timed out:', timeoutError);
        // Try the simplified method as a fallback
        console.log('Trying simplified letter fetching as fallback');
        const simpleLetters = await getSimpleLetters();
        if (simpleLetters && simpleLetters.length > 0) {
          console.log(`Loaded ${simpleLetters.length} letters using simplified method`);
          setLetters(simpleLetters);
          // Save the simplified letters to local storage
          await saveLettersToStorage(simpleLetters);
        } else {
          // Show empty state if all methods fail
          setLetters([]);
          setLoadError('Letter loading timed out. Please try refreshing or check your internet connection.');
        }
      }
    } catch (error) {
      console.error('Error loading initial letters:', error);
      setLetters([]);
      setLoadError('An error occurred while loading letters. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Delivers more random letters when the user presses the "Deliver Another Letter" button
   */
  const deliverMoreLetters = async () => {
    if (loadingMore || !user || !profile) return;
    
    // Check if user has enough stars
    if (profile.stars < 1) {
      Alert.alert('Not enough stars', 'You need 1 star to get new mail.');
      return;
    }
    
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
        Alert.alert('No Letters Available', 'There are no new letters available at the moment.');
        return;
      }
      
      // Spend 1 star only after we know we have letters to deliver
      const { error: starError } = await updateStars(-1);
      if (starError) {
        console.error('Error updating stars:', starError);
        Alert.alert('Error', 'Failed to spend star');
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
        // If we fail to track the letters, refund the star
        await updateStars(1);
        Alert.alert('Error', 'Failed to deliver new mail. Your star has been refunded.');
        return;
      }
      
      // Mark all as unread and add display_order
      const moreWithReadStatus = moreLetters.map((letter, index) => ({
        ...letter,
        is_read: false,
        display_order: maxDisplayOrder + index
      }));
      
      // Add new letters to animating set for animation
      setAnimatingLetterIds(prev => {
        const next = new Set(prev);
        moreWithReadStatus.forEach(letter => next.add(letter.id));
        return next;
      });
      
      // Prepend to the existing letters
      const updatedLetters = [...moreWithReadStatus, ...letters] as LetterWithDetails[];
      setLetters(updatedLetters);
      
      // Save the updated letters to local storage
      await saveLettersToStorage(updatedLetters);
      
      console.log(`Delivered ${moreLetters.length} more letters at the top`);
    } catch (error) {
      console.error('Error delivering more letters:', error);
      // Only try to refund if we actually spent the star (check if letters were added)
      if (letters.length > 0) {
        await updateStars(1);
        Alert.alert('Error', 'An error occurred. Your star has been refunded.');
      }
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
      console.log('Manually delivering letters...');
      setLoading(true);
      
      // Get the current delivery window
      const window = getCurrentDeliveryWindow();
      
      // Get unread letters not by the current user
      const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
      
      if (newLetters && newLetters.length > 0) {
        console.log(`Delivered ${newLetters.length} new letters`);
        setLetters(newLetters.map(letter => ({
          ...letter,
          is_read: false
        })));
        setAnyLettersInWindow(true);
      } else {
        console.log('No new letters available to deliver');
      }
    } catch (error) {
      console.error('Error delivering letters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('HomeScreen mounted or user changed');
    if (user) {
      console.log('User is authenticated, loading letters');
      loadInitialLetters();
    } else {
      console.log('No user, skipping letter loading');
      setLoading(false);
    }
  }, [user]);

  const handleLetterPress = async (letter: LetterWithDetails) => {
    // Navigate to letter detail as modal, passing the entire letter object
    navigation.navigate('LetterDetail', { 
      letterId: letter.id,
      letter: letter,
      onClose: () => navigation.goBack()
    });

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
        setLetters(prevLetters => {
          const updatedLetters = prevLetters.map(l => 
            l.id === letter.id ? { ...l, is_read: true } : l
          );
          
          // Update local storage with the read status
          updateLetterReadStatusInStorage(letter.id, true);
          
          return updatedLetters;
        });
      } catch (error) {
        console.error('Error marking letter as read:', error);
      }
    }
  };

  const renderNextWindowInfo = () => {
    if (!user) return null;

    return (
      <View style={styles.countdownContainer}>
        <Text style={[styles.countdownText, { color: '#FFFFFF', fontFamily: 'SourceCodePro-Regular' }]}>
          New mail in {timeUntilNext.hours}h:{timeUntilNext.minutes}m:{timeUntilNext.seconds}s
        </Text>
      </View>
    );
  };

  // Create redacted blocks for a letter
  const createRedactedBlocks = useCallback((content: string, itemId: string) => {
    // Split content into words and limit to what would reasonably fit in 2 lines
    const words = content.split(' ').slice(0, 15); // Approximate number of words for 2 lines

    return (
      <View style={styles.redactedContent}>
        {words.map((word, index) => {
          // Calculate width based on word length
          const width = Math.min(15 + word.length * 4, 100);
          return (
            <View
              key={`${itemId}-${index}`}
              style={[
                styles.redactedWord,
                { width }
              ]}
            />
          );
        })}
      </View>
    );
  }, []);

  const renderLetterItem = ({ item }: { item: LetterWithDetails }) => {
    const isUnread = !item.is_read;
    const categoryColor = item.category?.color || '#FFFFFF';
    const backgroundColor = isUnread ? categoryColor : `${categoryColor}40`; // 25% opacity for read letters
    const defaultMoodEmoji = '😊';

    // Only animate if the letter ID is in the animating set
    const isAnimating = animatingLetterIds.has(item.id);
    const fadeAnim = isAnimating ? getLetterAnimation(item.id) : new Animated.Value(1);

    return (
      <Animated.View style={isAnimating ? {
        opacity: fadeAnim,
        transform: [{
          translateY: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          }),
        }],
      } : {}}>
        <Card
          style={[
            styles.letterCard,
            { backgroundColor },
            isUnread && styles.unreadCard
          ]}
          onPress={() => handleLetterPress(item)}
        >
          <Card.Content>
            <View style={styles.threeColumnLayout}>
              {/* Left column: Mood emoji */}
              <View style={styles.leftColumn}>
                <View style={styles.moodEmojiContainer}>
                  <Text style={styles.moodEmoji}>{item.mood_emoji || defaultMoodEmoji}</Text>
                </View>
              </View>
              
              {/* Center column: Text and redacted preview */}
              <View style={styles.centerColumn}>
                <Title style={styles.letterTitle} numberOfLines={2} ellipsizeMode="tail">{item.title}</Title>
                {isUnread ? (
                  createRedactedBlocks(item.content, item.id)
                ) : (
                  <Paragraph style={styles.letterContent}>{item.content}</Paragraph>
                )}
              </View>
              
              {/* Right column: Category display at bottom */}
              <View style={styles.rightColumn}>
                <View style={styles.rightColumnContent}>
                  <Text style={styles.categoryName}>
                    {item.category?.name.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    );
  };

  // Filter letters to show only unread ones
  const unreadLetters = useMemo(() => {
    return letters.filter(letter => !letter.is_read);
  }, [letters]);

  const handleDeliverAnotherLetter = () => {
    // Trigger button animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Call the existing deliver function
    deliverMoreLetters();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.primary }]}>Loading your letters...</Text>
        </View>
      );
    }
    
    if (loadError) {
      return (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{loadError}</Text>
          <Button
            mode="contained"
            onPress={loadInitialLetters}
            style={styles.retryButton}
            icon="refresh"
          >
            Retry
          </Button>
        </View>
      );
    }
    
    if (!user) {
      return (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>Please log in to view your letters.</Text>
        </View>
      );
    }
    
    if (unreadLetters.length === 0) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
          {renderNextWindowInfo()}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Button
              mode="contained"
              onPress={handleDeliverAnotherLetter}
              style={[styles.deliverButton, { paddingHorizontal: 12 }]}
              loading={loadingMore}
              disabled={loadingMore || (profile?.stars ?? 0) < 1}
              textColor="#FFFFFF"
            >
              GET NEW MAIL 1 <Ionicons name="star" size={16} color="#FFD700" />
            </Button>
          </Animated.View>
        </View>
      );
    }
    
    return (
      <FlatList
        data={unreadLetters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
      />
    );
  };

  const renderHeader = () => {
    if (!user || unreadLetters.length === 0) return null;
    
    return (
      <View style={styles.headerContainer}>
        <View style={styles.countdownContainer}>
          <Text style={[styles.countdownText, { color: '#FFFFFF', fontFamily: 'SourceCodePro-Regular' }]}>
            New mail in {timeUntilNext.hours}h:{timeUntilNext.minutes}m:{timeUntilNext.seconds}s
          </Text>
        </View>
        <Button 
          mode="outlined"
          onPress={deliverMoreLetters}
          loading={loadingMore}
          disabled={loadingMore || (profile?.stars ?? 0) < 1}
          style={[styles.deliverMoreButton, { borderColor: '#FFFFFF', paddingHorizontal: 12 }]}
          textColor="#FFFFFF"
        >
          GET NEW MAIL 1 <Ionicons name="star" size={16} color="#FFD700" />
        </Button>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderContent()}
    </View>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  deliverButton: {
    marginTop: 20,
    marginBottom: 15,
    width: '80%',
  },
  writeButton: {
    marginTop: 10,
    width: '80%',
  },
  buttonLabel: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  letterCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
  },
  unreadCard: {
    elevation: 4,
  },
  threeColumnLayout: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftColumn: {
    marginRight: 8,
  },
  centerColumn: {
    flex: 1,
    overflow: 'hidden',
  },
  rightColumn: {
    marginLeft: 8,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  rightColumnContent: {
    marginTop: 'auto',
  },
  moodEmojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 24,
  },
  letterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
    fontFamily: 'SourceCodePro-SemiBold',
    lineHeight: 18,
    letterSpacing: -1,
  },
  letterContent: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  redactedContent: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    maxHeight: 48, // Allow for 3 lines (10px height + 4px margin-bottom) * 3
  },
  redactedWord: {
    height: 10,
    backgroundColor: '#000000',
    marginRight: 4,
    marginBottom: 4,
    opacity: 0.8,
  },
  headerContainer: {
    marginBottom: 16,
    alignItems: 'center',
    paddingTop: 16,
  },
  countdownContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  deliverMoreButton: {
    width: '80%',
  },
  retryButton: {
    marginTop: 20,
    width: '80%',
  },
});

export default HomeScreen; 