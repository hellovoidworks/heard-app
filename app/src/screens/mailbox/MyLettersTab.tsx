import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Button, useTheme } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontNames } from '../../utils/fonts';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Letter = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
  mood_emoji?: string;
  view_count: number;
  reply_count: number;
  reaction_count: number;
  display_name?: string;
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

const MyLettersTab = () => {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const fetchMyLetters = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // Get all letters with their stats in a single query using the fixed database function
      const { data, error } = await supabase
        .rpc('get_my_letters_with_stats', { user_id: user.id });
        
      // Debug: Log the raw data to see what we're getting from the database
      console.log('Raw letter data from database:', data ? data.slice(0, 2) : 'No data');

      if (error) {
        console.error('Error fetching letters with stats:', error);
        return;
      }

      if (!data || data.length === 0) {
        setLetters([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Process the data to match our Letter type
      const processedLetters = data.map((letter: any) => {
        // Debug: Log each letter's view count
        console.log(`Letter "${letter.title}": view_count=${letter.view_count}, type=${typeof letter.view_count}`);
        
        return ({
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
        display_name: letter.display_name
      });
      });

      setLetters(processedLetters);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyLetters();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMyLetters();
  };

  const handleLetterPress = (letter: Letter) => {
    // Pass the full letter data along with counts to avoid redundant fetching
    navigation.navigate('MyLetterDetail', { 
      letterId: letter.id,
      letterData: {
        id: letter.id,
        title: letter.title,
        content: letter.content,
        created_at: letter.created_at,
        category: letter.category,
        mood_emoji: letter.mood_emoji,
        author_id: user?.id || '', // Since this is the user's letter
        display_name: letter.display_name
      },
      initialStats: {
        replyCount: letter.reply_count,
        readCount: letter.view_count,
        reactionCount: letter.reaction_count
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

    return (
      <Card
        style={[
          styles.letterCard,
          { 
            backgroundColor,
            borderWidth: 1,
            borderColor: categoryColor 
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
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
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