import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Animated, Easing, Alert, AppState, AppStateStatus } from 'react-native';
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
  getTimeUntilNextWindow,
  MORNING_HOUR,
  MORNING_MINUTE_TEST
} from '../utils/deliveryWindow';
import { StorageService, STORAGE_KEYS } from '../services/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;


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
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);

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

  // Update the time until next window every second and check for window transitions
  useEffect(() => {
    let previousTimeUntilNext = { hours: 0, minutes: 0, seconds: 0 };
    
    const updateTimeUntilNext = async () => {
      const newTimeUntilNext = getTimeUntilNextWindow();
      setTimeUntilNext(newTimeUntilNext);
      
      // Check if timer just reached zero (all values were > 0 before and now they're all 0)
      const wasPositive = previousTimeUntilNext.hours > 0 || previousTimeUntilNext.minutes > 0 || previousTimeUntilNext.seconds > 0;
      const isZero = newTimeUntilNext.hours === 0 && newTimeUntilNext.minutes === 0 && newTimeUntilNext.seconds === 0;
      
      if (wasPositive && isZero) {
        console.log('Countdown timer reached zero, new delivery window starting');
        // Update the current window
        const window = getCurrentDeliveryWindow();
        setCurrentWindow(window);
        setFormattedWindow(formatDeliveryWindow(window.start, window.end));
        
        // Auto-refresh letters for the new window
        try {
          setLoading(true);
          setLoadError(null);
          
          console.log('Auto-fetching letters for new delivery window');
          // Force the current window to be treated as a new window to get INITIAL_LETTERS_LIMIT letters
          const updatedWindow = { ...currentWindow, isNewWindow: true };
          setCurrentWindow(updatedWindow);
          const fetchedLetters = await getLettersForCurrentWindow();
          
          if (fetchedLetters && fetchedLetters.length > 0) {
            console.log(`Auto-loaded ${fetchedLetters.length} letters for new window`);
            
            // Add new letters to animating set for animation
            setAnimatingLetterIds(prev => {
              const next = new Set(prev);
              fetchedLetters.forEach((letter: LetterWithDetails) => next.add(letter.id));
              return next;
            });
            
            setLetters(fetchedLetters);
            // Save fetched letters to local storage
            await saveLettersToStorage(fetchedLetters);
          } else {
            console.log('No letters available in new window');
            setLetters([]);
          }
        } catch (error) {
          console.error('Error auto-loading letters for new window:', error);
          setLoadError('Failed to load new letters. Pull down to refresh.');
        } finally {
          setLoading(false);
        }
      }
      
      // Update previous time for next comparison
      previousTimeUntilNext = newTimeUntilNext;
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
  
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('APPSTATE DEBUG: App state changed from', appState.current, 'to', nextAppState);
      
      // Check if app is coming back to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('APPSTATE DEBUG: App has come to the foreground!');
        
        // Get current time and window
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const window = getCurrentDeliveryWindow();
        
        console.log('APPSTATE DEBUG: Current time:', now.toLocaleString());
        console.log('APPSTATE DEBUG: Current window:', {
          start: window.start.toLocaleString(),
          end: window.end.toLocaleString(),
          isNewWindow: window.isNewWindow
        });
        
        // Check if we're past the test minute for the current hour
        const isPastTestMinute = currentHour === MORNING_HOUR && currentMinute >= MORNING_MINUTE_TEST;
        console.log('APPSTATE DEBUG: Is past test minute?', isPastTestMinute);
        
        // If we're past the test minute or in a new window, reload letters
        if (isPastTestMinute || window.isNewWindow) {
          console.log('APPSTATE DEBUG: Past test minute or new window, reloading letters');
          setCurrentWindow(window);
          loadInitialLetters();
        }
      }
      
      // Update app state
      appState.current = nextAppState;
      setAppStateVisible(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
      const now = new Date();
      
      // Check if the stored letters are from the current window
      // AND if we're not past the test minute for the current hour
      const isCurrentWindow = (
        receivedTime >= deliveryWindow.start && 
        receivedTime < deliveryWindow.end &&
        // Additional check: if we're in the morning hour, make sure we haven't passed the test minute
        !(now.getHours() === MORNING_HOUR && now.getMinutes() >= MORNING_MINUTE_TEST)
      );
      
      console.log('WINDOW DEBUG: Storage validation:', {
        now: now.toLocaleString(),
        currentHour: now.getHours(),
        currentMinute: now.getMinutes(),
        morningHour: MORNING_HOUR,
        morningMinuteTest: MORNING_MINUTE_TEST,
        isPastTestMinute: now.getHours() === MORNING_HOUR && now.getMinutes() >= MORNING_MINUTE_TEST
      });
      
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
   * Checks if we need to deliver new letters by comparing the latest received letter's timestamp
   * with the current delivery window
   */
  const shouldDeliverNewLetters = async (): Promise<boolean> => {
    if (!user) {
      console.log('DELIVERY DEBUG: No user found, cannot deliver letters');
      return false;
    }
    
    try {
      console.log('DELIVERY DEBUG: Checking if we should deliver new letters');
      console.log('DELIVERY DEBUG: Current window:', {
        start: currentWindow.start.toLocaleString(),
        end: currentWindow.end.toLocaleString(),
        isNewWindow: currentWindow.isNewWindow
      });
      
      // Get the latest letter received by this user
      console.log('DELIVERY DEBUG: Fetching latest letter received by user', user.id);
      const { data: latestDelivery, error } = await supabase
        .from('letter_received')
        .select('received_at, letter_id')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('DELIVERY DEBUG: Error checking latest delivery:', error);
        return false;
      }
      
      // If no letters have been received yet, we should definitely deliver
      if (!latestDelivery || latestDelivery.length === 0) {
        console.log('DELIVERY DEBUG: No previous letters found, should deliver new letters');
        return true;
      }
      
      // Get the timestamp of the latest received letter
      const latestDeliveryTime = new Date(latestDelivery[0].received_at);
      
      console.log('DELIVERY DEBUG: Latest delivery time:', latestDeliveryTime.toLocaleString());
      console.log('DELIVERY DEBUG: Latest letter ID:', latestDelivery[0].letter_id);
      console.log('DELIVERY DEBUG: Current window start:', currentWindow.start.toLocaleString());
      console.log('DELIVERY DEBUG: Current time:', new Date().toLocaleString());
      
      // If the latest letter was received before the current window started,
      // we need to deliver new letters
      const shouldDeliver = latestDeliveryTime < currentWindow.start;
      console.log('DELIVERY DEBUG: Should deliver new letters?', shouldDeliver, 
        '(latest delivery was', shouldDeliver ? 'before' : 'after', 'current window start)');
      
      return shouldDeliver;
    } catch (error) {
      console.error('Error in shouldDeliverNewLetters:', error);
      return false;
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
      console.log('WINDOW DEBUG: Checking for existing deliveries in current window:', 
        currentWindow.start.toISOString(), 'to', currentWindow.end.toISOString());
      console.log('WINDOW DEBUG: User ID:', user.id);
      
      const { data: existingDeliveries, error: deliveryError } = await supabase
        .from('letter_received')
        .select('letter_id, display_order, received_at')
        .eq('user_id', user.id)
        .gte('received_at', currentWindow.start.toISOString())
        .lt('received_at', currentWindow.end.toISOString())
        .order('display_order', { ascending: true });
        
      // Add a query to check all letter_received entries for this user
      const { data: allUserDeliveries, error: allDeliveriesError } = await supabase
        .from('letter_received')
        .select('letter_id, received_at')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(20);
        
      console.log('WINDOW DEBUG: All recent deliveries for user:', 
        allUserDeliveries?.map(d => ({ 
          letter_id: d.letter_id, 
          received_at: new Date(d.received_at).toLocaleString() 
        })));
      
      if (allDeliveriesError) {
        console.error('WINDOW DEBUG: Error checking all deliveries:', allDeliveriesError);
      }
      
      if (deliveryError) {
        console.error('Error checking for existing deliveries:', deliveryError);
        return [];
      }
      
      console.log('WINDOW DEBUG: existingDeliveries query completed', existingDeliveries?.length || 0);
      
      if (existingDeliveries && existingDeliveries.length > 0) {
        console.log(`WINDOW DEBUG: Found ${existingDeliveries.length} letters already delivered in this window`);
        console.log('WINDOW DEBUG: First 5 existing deliveries:', 
          existingDeliveries.slice(0, 5).map(d => ({
            letter_id: d.letter_id,
            received_at: new Date(d.received_at).toLocaleString()
          })));
        setAnyLettersInWindow(true);
        
        // Check if these letters were received within the last 2 seconds
        const now = new Date();
        const twoSecondsAgo = new Date(now.getTime() - 2 * 1000);
        const recentDeliveries = existingDeliveries.filter(d => 
          new Date(d.received_at) > twoSecondsAgo
        );
        
        console.log(`WINDOW DEBUG: Found ${recentDeliveries.length} letters delivered in the last 2 seconds`);
        console.log('WINDOW DEBUG: Current time:', now.toISOString());
        console.log('WINDOW DEBUG: Two seconds ago:', twoSecondsAgo.toISOString());
        
        // Always check if we should deliver new letters when we're in a new window
        if (currentWindow.isNewWindow) {
          console.log('WINDOW DEBUG: We are in a new window, checking if we should deliver new letters');
          
          // If we have recent deliveries, we've already delivered for this window
          if (recentDeliveries.length > 0) {
            console.log('WINDOW DEBUG: Found recent deliveries, using those instead of fetching new ones');
          } else {
            // No recent deliveries, check if we should deliver based on latest received letter
            console.log('WINDOW DEBUG: No recent deliveries in new window, checking if we should fetch new letters');
            
            // Always force delivery in a new window if no recent deliveries
            console.log('WINDOW DEBUG: Fetching new letters for new window');
            const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT, true);
            if (newLetters.length > 0) {
              console.log(`WINDOW DEBUG: Successfully fetched ${newLetters.length} new letters`);
              return newLetters;
            } else {
              console.log('WINDOW DEBUG: No new letters available to fetch');
            }
          }
        }
        
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
        // No letters delivered in this window yet, check if we should deliver new ones
        console.log('No letters delivered in this window yet, checking if we should deliver new ones');
        setAnyLettersInWindow(false);
        
        // Use our new logic to determine if we should deliver new letters
        const shouldDeliver = await shouldDeliverNewLetters();
        
        if (shouldDeliver) {
          console.log('New delivery window detected based on latest letter timestamp, delivering fresh letters');
          console.log('DEBUG: Calling getUnreadLettersNotByUser');
          const newLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
          console.log('DEBUG: getUnreadLettersNotByUser returned', newLetters?.length || 0, 'letters');
          return newLetters.map((letter: LetterWithDetails) => ({
            ...letter,
            is_read: false
          }));
        } else {
          // If we shouldn't deliver new letters, return an empty set
          console.log('Not a new delivery window based on latest letter timestamp, returning empty set');
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
   * Uses the database function get_unread_letters_not_by_user for improved performance
   * @param limit Number of letters to fetch
   * @param forceDelivery If true, forces delivery even if there are no unread letters available
   */
  const getUnreadLettersNotByUser = async (limit: number = INITIAL_LETTERS_LIMIT, forceDelivery: boolean = false) => {
    console.log('FETCH DEBUG: getUnreadLettersNotByUser - Start', limit, forceDelivery ? '(forced)' : '');
    console.log('FETCH DEBUG: Current time:', new Date().toLocaleString());
    
    if (!user) {
      console.log('FETCH DEBUG: No user found, cannot fetch letters');
      return [];
    }
    
    try {
      // Call the optimized database function to get unread letters
      console.log('FETCH DEBUG: Calling database function with user_id:', user.id, 'and limit:', limit);
      const { data, error } = await supabase
        .rpc('get_unread_letters_not_by_user', {
          p_user_id: user.id,
          p_limit: limit
        });
      
      if (error) {
        console.error('FETCH DEBUG: Error calling get_unread_letters_not_by_user:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log('FETCH DEBUG: No unread letters available');
        if (forceDelivery) {
          console.log('FETCH DEBUG: Force delivery requested but no letters available');
        }
        return [];
      }
      
      // Transform the data to match the expected format
      const resultLetters = data.map((letter: any) => ({
        id: letter.id,
        title: letter.title,
        content: letter.content,
        created_at: letter.created_at,
        author_id: letter.author_id,
        category_id: letter.category_id,
        mood_emoji: letter.mood_emoji,
        category: {
          name: letter.category_name,
          color: letter.category_color
        },
        display_name: letter.display_name,
        author: letter.author,
        is_read: letter.is_read,
        display_order: letter.display_order
      }));
      
      console.log(`FETCH DEBUG: getUnreadLettersNotByUser - Returning ${resultLetters.length} letters`);
      console.log('FETCH DEBUG: Letter IDs:', resultLetters.map(letter => letter.id).join(', '));
      
      // The database function already handles tracking letters as received
      if (resultLetters.length > 0) {
        console.log('FETCH DEBUG: Setting anyLettersInWindow to true');
        setAnyLettersInWindow(true);
      }
      
      return resultLetters;
      
    } catch (error) {
      console.error('Error fetching unread letters:', error);
      return [];
    }
  };
  


  /**
   * Checks if the user has just completed onboarding
   */
  const checkIfNewlyOnboarded = async () => {
    if (!user) return false;
    
    try {
      // Check if the user has any letters received
      const { data: existingLetters, error: letterError } = await supabase
        .from('letter_received')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
        
      if (letterError) {
        console.error('Error checking for existing letters:', letterError);
        return false;
      }
      
      // If user has no letters, they're newly onboarded
      if (!existingLetters || existingLetters.length === 0) {
        console.log('User has no existing letters, treating as newly onboarded');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking if newly onboarded:', error);
      return false;
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
      
      // Check if this is a newly onboarded user with no letters
      const isNewlyOnboarded = await checkIfNewlyOnboarded();
      if (isNewlyOnboarded) {
        console.log('Newly onboarded user detected, treating as new delivery window');
        // Force the current window to be treated as a new window
        setCurrentWindow(prev => ({ ...prev, isNewWindow: true }));
        // Also set anyLettersInWindow to false to ensure we trigger letter delivery
        setAnyLettersInWindow(false);
      }
      
      console.log('DEBUG: Calling getLettersForCurrentWindow with timeout...');
      
      // Fetch letters directly without timeout fallback
      let fetchedLetters = await getLettersForCurrentWindow();
      
      console.log('DEBUG: getLettersForCurrentWindow returned', fetchedLetters?.length || 0, 'letters');
      
      // If no letters were returned and this is a newly onboarded user, force deliver letters
      if ((!fetchedLetters || fetchedLetters.length === 0) && isNewlyOnboarded) {
        console.log('No letters returned for newly onboarded user, forcing letter delivery');
        // Force deliver letters for new users
        fetchedLetters = await getUnreadLettersNotByUser(INITIAL_LETTERS_LIMIT);
        console.log('Forced delivery returned', fetchedLetters?.length || 0, 'letters');
      }
      
      if (fetchedLetters && fetchedLetters.length > 0) {
        console.log(`Loaded ${fetchedLetters.length} letters successfully`);
        setLetters(fetchedLetters);
        // Save fetched letters to local storage
        await saveLettersToStorage(fetchedLetters);
      } else {
        console.log('No letters returned by getLettersForCurrentWindow. Displaying empty list.');
        setLetters([]);
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
   * Optimized to improve loading performance
   */
  const deliverMoreLetters = async () => {
    if (loadingMore || !user || !profile) return;
    
    // Check if user has enough stars
    if (profile.stars < 1) {
      Alert.alert('Not enough stars', 'You need 1 star to get new mail.');
      return;
    }
    
    try {
      // Set loading state immediately for better user feedback
      setLoadingMore(true);
      
      // Calculate display order for new letters - use values higher than current max
      // to ensure new letters appear at the top
      let maxDisplayOrder = 0;
      if (letters.length > 0) {
        // Find the highest current display_order value
        maxDisplayOrder = Math.max(...letters.map(letter => letter.display_order || 0)) + 1000; 
        // Add a big increment to ensure new letters have higher values
      }
      
      // Fetch letters directly without timeout fallback
      const moreLetters = await getUnreadLettersNotByUser(MORE_LETTERS_LIMIT);
      
      if (!moreLetters || moreLetters.length === 0) {
        console.log('No more unread letters available');
        Alert.alert('No Letters Available', 'There are no new letters available at the moment.');
        setLoadingMore(false);
        return;
      }
      
      // Spend 1 star only after we know we have letters to deliver
      const { error: starError } = await updateStars(-1);
      if (starError) {
        console.error('Error updating stars:', starError);
        Alert.alert('Error', 'Failed to spend star');
        setLoadingMore(false);
        return;
      }
      
      // Prepare letter data for UI update immediately
      const moreWithReadStatus = moreLetters.map((letter: any, index: number) => ({
        ...letter,
        is_read: false,
        display_order: maxDisplayOrder + index
      }));
      
      // Add new letters to animating set for animation
      setAnimatingLetterIds(prev => {
        const next = new Set(prev);
        moreWithReadStatus.forEach((letter: LetterWithDetails) => next.add(letter.id));
        return next;
      });
      
      // Update UI immediately for better perceived performance
      const updatedLetters = [...moreWithReadStatus, ...letters] as LetterWithDetails[];
      setLetters(updatedLetters);
      
      // Create letter_received entries for each additional letter with higher display_order
      const letterReceivedEntries = moreLetters.map((letter: any, index: number) => ({
        user_id: user.id,
        letter_id: letter.id,
        received_at: new Date().toISOString(),
        display_order: maxDisplayOrder + index // Higher values to appear at the top
      }));
      
      // Perform database operations in parallel
      const [storageResult, trackingResult] = await Promise.all([
        // Save to local storage
        saveLettersToStorage(updatedLetters),
        
        // Insert tracking records
        supabase
          .from('letter_received')
          .upsert(letterReceivedEntries, { 
            onConflict: 'user_id,letter_id', 
            ignoreDuplicates: false // Update display_order if entry exists
          })
      ]);
      
      if (trackingResult.error) {
        console.error('Error tracking received letters:', trackingResult.error);
        // Don't revert UI changes, just log the error
        // We already updated the UI, and the user has the letters
      }
      
      console.log(`Delivered ${moreLetters.length} more letters at the top`);
    } catch (error) {
      console.error('Error delivering more letters:', error);
      // Only try to refund if we actually spent the star
      try {
        await updateStars(1);
        Alert.alert('Error', 'An error occurred. Your star has been refunded.');
      } catch (refundError) {
        console.error('Error refunding star:', refundError);
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
        setLetters(newLetters.map((letter: LetterWithDetails) => ({
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

  // Create redacted text using Flow Circular font
  const createRedactedText = useCallback((content: string) => {
    // Ensure we have enough content to fill 2 lines
    const minLength = Math.max(content.length, 60);
    // Limit content to what would reasonably fit in 2 lines
    const truncatedContent = content.length > 120 ? content.substring(0, 120) + '...' : content;
    
    return (
      <Text style={styles.redactedContent} numberOfLines={2} ellipsizeMode="tail">
        {truncatedContent}
      </Text>
    );
  }, []);

  const renderLetterItem = ({ item }: { item: LetterWithDetails }) => {
    const isUnread = !item.is_read;
    const categoryColor = item.category?.color || '#FFFFFF';
    // Use category color with opacity 0.2 for background
    const backgroundColor = `${categoryColor}33`; // 20% opacity
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
            { 
              backgroundColor,
              borderWidth: 1,
              borderColor: categoryColor 
            },
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
                  createRedactedText(item.content)
                ) : (
                  <Paragraph style={styles.letterContent}>{item.content}</Paragraph>
                )}
              </View>
              
              {/* Right column: Category display */}
              <View style={styles.rightColumn}>
                <View style={[styles.categoryContainer, { backgroundColor: `${categoryColor}66` }]}>
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
          <Text style={styles.emptyText}>No unread mail</Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('WriteLetter', {})}
            style={[styles.writeLetterButton, { backgroundColor: theme.colors.primary }]}
            labelStyle={styles.writeLetterButtonLabel}
          >
            Write Mail +5<Ionicons name="star" size={16} color="#FFD700" />
          </Button>
        </View>
      );
    }
    
    return (
      <FlatList
        data={unreadLetters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }} // Increased padding to make room for the footer with extra spacing
      />
    );
  };

  const renderHeader = () => {
    if (!user || unreadLetters.length === 0) return null;
    
    return (
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Your Unread Mail</Text>
      </View>
    );
  };
  
  // New function to render the footer with the countdown and button
  const renderFooter = () => {
    if (!user) return null;
    
    return (
      <View style={styles.footerContainer}>
        <View style={styles.countdownContainer}>
          <Text style={[styles.countdownText, { color: '#FFFFFF', fontFamily: 'SourceCodePro-Regular' }]}>
            New mail in {timeUntilNext.hours}h:{timeUntilNext.minutes}m:{timeUntilNext.seconds}s
          </Text>
        </View>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Button 
            mode="outlined"
            onPress={handleDeliverAnotherLetter}
            loading={loadingMore}
            disabled={loadingMore || (profile?.stars ?? 0) < 1}
            style={[styles.deliverMoreButton, { 
              borderColor: (loadingMore || (profile?.stars ?? 0) < 1) ? '#888888' : '#FFFFFF', 
              paddingHorizontal: 12, 
              alignSelf: 'center' 
            }]}
            textColor="#FFFFFF"
          >
            {(profile?.stars ?? 0) < 1 ? 
              <>WRITE OR REPLY TO GET <Ionicons name="star" size={16} color="#888888" /></> : 
              <>GET NEW MAIL 1 <Ionicons name="star" size={16} color="#FFD700" /></>
            }
          </Button>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderContent()}
      {renderFooter()}
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
    width: 280,
  },
  writeButton: {
    marginTop: 10,
    width: '80%',
  },
  writeLetterButton: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  writeLetterButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
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
    alignItems: 'flex-start',
  },
  leftColumn: {
    marginRight: 8,
    alignSelf: 'center',
  },
  centerColumn: {
    flex: 1,
    overflow: 'hidden',
  },
  rightColumn: {
    marginLeft: 8,
    width: 75,
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  moodEmojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 28,
  },
  letterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#FFFFFF',
    fontFamily: 'SourceCodePro-SemiBold',
    lineHeight: 16,
    letterSpacing: -1,
  },
  letterContent: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  categoryContainer: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    fontFamily: 'SourceCodePro-SemiBold',
  },
  redactedContent: {
    marginTop: -2,
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36, // Ensure space for exactly 2 lines
    maxHeight: 36, // Limit to exactly 2 lines at 18px line height
    overflow: 'hidden',
    fontFamily: 'FlowCircular_400Regular',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  headerContainer: {
    marginBottom: 16,
    alignItems: 'center',
    paddingTop: 16,
    width: '100%',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'SourceCodePro-SemiBold',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121212', // Changed to match bottom navigation background color
    paddingTop: 12,
    paddingBottom: 24, // Increased bottom padding to avoid overlap with the + circle button
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
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
    width: 320,
  },
  retryButton: {
    marginTop: 20,
    width: '80%',
  },
});

export default HomeScreen; 