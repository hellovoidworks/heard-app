import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Button, useTheme } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';

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

      // Get all letters authored by the user
      const { data, error } = await supabase
        .from('letters')
        .select(`
          id,
          title,
          content,
          created_at,
          category:categories(id, name, color),
          mood_emoji
        `)
        .eq('author_id', user.id)
        // No longer filtering by parent_id as we've moved to using the replies table
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching letters:', error);
        return;
      }

      if (!data || data.length === 0) {
        setLetters([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Process the data to ensure category is correctly formatted
      const processedLetters = data.map(letter => ({
        id: letter.id,
        title: letter.title,
        content: letter.content,
        created_at: letter.created_at,
        category: Array.isArray(letter.category) 
          ? (letter.category.length > 0 ? letter.category[0] : null) 
          : letter.category,
        mood_emoji: letter.mood_emoji
      }));

      setLetters(processedLetters as Letter[]);
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
    navigation.navigate('MyLetterDetail', { letterId: letter.id });
  };

  const renderLetterItem = ({ item }: { item: Letter }) => {
    const categoryColor = item.category?.color || '#333333';
    // Use category color with opacity 0.2 for background
    const backgroundColor = `${categoryColor}33`; // 20% opacity
    const defaultMoodEmoji = '😊';

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
          <View style={styles.threeColumnLayout}>
            {/* Left column: Mood emoji */}
            <View style={styles.leftColumn}>
              <View style={styles.moodEmojiContainer}>
                <Text style={styles.moodEmoji}>{item.mood_emoji || defaultMoodEmoji}</Text>
              </View>
            </View>
            
            {/* Center column: Text and preview */}
            <View style={styles.centerColumn}>
              <Title style={styles.letterTitle} numberOfLines={2} ellipsizeMode="tail">{item.title}</Title>
              <Paragraph style={styles.letterContent} numberOfLines={2}>{item.content}</Paragraph>
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
});

export default MyLettersTab; 