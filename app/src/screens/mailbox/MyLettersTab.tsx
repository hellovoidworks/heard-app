import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Button, useTheme } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontNames } from '../../utils/fonts';
import { useDataWithCache } from '../../hooks/useDataWithCache';
import dataCache from '../../utils/dataCache';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Letter = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category?: {
    id: string;
    name: string;
    color: string;
  } | null;
  mood_emoji?: string;
  view_count?: number;
  reply_count?: number;
  reaction_count?: number;
  display_name?: string;
  has_unread_reactions?: boolean;
};

type Props = {
  onUnreadReactionsCountChange?: (count: number) => void;
};

// Helper function to format numbers (e.g., 1100 -> 1.1k)
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

const MyLettersTab: React.FC<Props> = ({ onUnreadReactionsCountChange }) => {
  // Keep track of the last viewed letter to update its unread status when returning to this screen
  const [lastViewedLetterId, setLastViewedLetterId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  // Define the fetch function that will be used by our hook
  const fetchMyLetters = useCallback(async (): Promise<Letter[]> => {
    if (!user) return [];

    console.log('[MyLettersTab] Fetching my letters');
    
    // Get all letters with their stats in a single query using the fixed database function
    const { data, error } = await supabase
      .rpc('get_my_letters_with_stats', { user_id: user.id });
      
    // Debug: Log the raw data to see what we're getting from the database
    console.log('[MyLettersTab] Raw letter data from database:', data ? data.slice(0, 2) : 'No data');

    if (error) {
      console.error('[MyLettersTab] Error fetching letters with stats:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Process the data to match our Letter type
    const processedLetters = data.map((letter: any) => ({
      id: letter.id,
      title: letter.title,
      content: letter.content,
      created_at: letter.created_at,
      category: letter.category_id ? {
        id: letter.category_id,
        name: letter.category_name,
        color: letter.category_color
      } : null,
      mood_emoji: letter.mood_emoji,
      view_count: parseInt(letter.view_count) || 0,
      reply_count: parseInt(letter.reply_count) || 0,
      reaction_count: parseInt(letter.reaction_count) || 0,
      display_name: letter.display_name,
      has_unread_reactions: letter.has_unread_reactions
    }));

    // Sort letters - unread reactions first, then by creation date (newest first)
    return [...processedLetters].sort((a, b) => {
      // First sort by unread reactions (true values first)
      if (a.has_unread_reactions && !b.has_unread_reactions) return -1;
      if (!a.has_unread_reactions && b.has_unread_reactions) return 1;
      
      // Then sort by date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [user]);

  // Handler for when data is loaded
  const handleDataLoaded = useCallback((letters: Letter[]) => {
    // Count letters with unread reactions
    const unreadCount = letters.filter(letter => letter.has_unread_reactions).length;
    
    // Notify parent component about the unread count
    if (onUnreadReactionsCountChange) {
      onUnreadReactionsCountChange(unreadCount);
    }
  }, [onUnreadReactionsCountChange]);

  // Use our custom hook for data fetching with cache
  const {
    data: letters = [],
    initialLoading,
    refreshing,
    handleRefresh,
    handleFocus,
    setData: setLetters
  } = useDataWithCache<Letter[]>({
    cacheKey: dataCache.CACHE_KEYS.MY_LETTERS,
    fetchFunction: fetchMyLetters,
    initialData: [],
    onDataLoaded: handleDataLoaded
  });
  
  // Handle specific letter updates when returning from letter detail
  useEffect(() => {
    if (lastViewedLetterId && letters.length > 0) {
      console.log(`[MyLettersTab] Updating unread status for letter: ${lastViewedLetterId}`);
      
      // Update the letter in our local state to mark reactions as read
      const updatedLetters = letters.map(letter => {
        if (letter.id === lastViewedLetterId) {
          // Mark this letter as having no unread reactions
          return { ...letter, has_unread_reactions: false };
        }
        return letter;
      }).sort((a, b) => {
        // Re-sort the letters after updating
        if (a.has_unread_reactions && !b.has_unread_reactions) return -1;
        if (!a.has_unread_reactions && b.has_unread_reactions) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      // Set the updated letters
      setLetters(updatedLetters);
      
      // Update the cache with the modified letters
      dataCache.saveToCache(dataCache.CACHE_KEYS.MY_LETTERS, updatedLetters);
      
      // Count letters with unread reactions after the update
      const newUnreadCount = updatedLetters.filter(letter => letter.has_unread_reactions).length;
      
      // Notify parent component about the updated unread count
      if (onUnreadReactionsCountChange) {
        onUnreadReactionsCountChange(newUnreadCount);
      }
      
      // Reset the lastViewedLetterId
      setLastViewedLetterId(null);
    }
  }, [lastViewedLetterId, letters, setLetters, onUnreadReactionsCountChange]);
  
  // Register focus effect to handle tab focus
  useFocusEffect(
    useCallback(() => {
      console.log('[MyLettersTab] Screen focused');
      
      // Skip background refresh if we're updating a specific letter
      if (!lastViewedLetterId) {
        handleFocus();
      }
      
      return () => {
        // Cleanup function when component loses focus (optional)
      };
    }, [handleFocus, lastViewedLetterId])
  );

  const handleLetterPress = (letter: Letter) => {
    // Store the letter ID being viewed
    setLastViewedLetterId(letter.id);
    
    // Pass the full letter data along with counts to avoid redundant fetching
    navigation.navigate('MyLetterDetail', { 
      letterId: letter.id,
      letterData: {
        id: letter.id,
        title: letter.title,
        content: letter.content,
        created_at: letter.created_at,
        category: letter.category || null,
        mood_emoji: letter.mood_emoji || '',
        author_id: user?.id || '', // Since this is the user's letter
        display_name: letter.display_name
      },
      initialStats: {
        readCount: letter.view_count || 0,
        replyCount: letter.reply_count || 0,
        reactionCount: letter.reaction_count || 0
      }
    });
  };

  const renderLetterItem = ({ item }: { item: Letter }) => {
    const categoryColor = item.category?.color || '#333333';
    // Use category color with opacity 0.2 for background
    const backgroundColor = `${categoryColor}33`; // 20% opacity
    const defaultMoodEmoji = '😊';
    // Format the date to display in the top right corner (month and date only)
    const formattedDate = format(new Date(item.created_at), 'MMM d');
    const hasUnreadReactions = item.has_unread_reactions === true;

    return (
      <View style={{ position: 'relative' }}>
        {hasUnreadReactions && (
          <View 
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: '#FF6347',
              position: 'absolute',
              top: 16,
              left: 24,
              zIndex: 1,
            }} 
          />
        )}
        <Card
          style={[
            styles.letterCard,
            { 
              backgroundColor,
              borderWidth: 1,
              borderColor: categoryColor,
              ...(hasUnreadReactions ? { elevation: 4 } : {})
            }
          ]}
          onPress={() => handleLetterPress(item)}
        >
          <Card.Content>
            {/* Date display is now moved to be inline with title */}
            <View style={styles.threeColumnLayout}>
              {/* Left column: Mood emoji */}
              <View style={styles.leftColumn}>
                <View style={[styles.moodEmojiContainer, { backgroundColor: `${categoryColor}66` }]}>
                  <Text style={styles.moodEmoji}>{item.mood_emoji || defaultMoodEmoji}</Text>
                </View>
              </View>
              
              {/* Center column: Text and preview */}
              <View style={styles.centerColumn}>
                <Title style={styles.letterTitle} numberOfLines={2} ellipsizeMode="tail">{item.title}</Title>
                <Paragraph style={styles.letterContent} numberOfLines={2}>{item.content}</Paragraph>
                
                {/* Statistics row */}
                <View style={styles.statsContainer}>
                  {/* Views */}
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="eye-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.statText}>{formatNumber(item.view_count || 0)}</Text>
                  </View>
                  
                  {/* Replies */}
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="reply-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.statText}>{formatNumber(item.reply_count || 0)}</Text>
                  </View>
                  
                  {/* Reactions */}
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="emoticon-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.statText}>{formatNumber(item.reaction_count || 0)}</Text>
                  </View>
                </View>
              </View>
              
              {/* Right column: Date and Category display */}
              <View style={styles.rightColumn}>
                <Text style={styles.dateText}>{formattedDate}</Text>
                <View style={[styles.categoryContainer, { backgroundColor: `${categoryColor}66` }]}>
                  <Text style={styles.categoryName}>
                    {item.category?.name.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={letters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.onBackground }]}>
              You haven't written any letters yet
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  letterCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
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
    alignSelf: 'flex-start',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  moodEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 26,
  },
  letterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: fontNames.interSemiBold,
    lineHeight: 18,
    letterSpacing: 0,
    marginBottom: 6,
  },
  letterContent: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 18,
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
    fontFamily: fontNames.interSemiBold,
  },

  dateText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: fontNames.interRegular,
    opacity: 0.8,
    textAlign: 'right',
    marginBottom: 4,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 20,
  },
  writeButton: {
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginLeft: 4,
    fontFamily: fontNames.interRegular,
  },
});

export default MyLettersTab; 