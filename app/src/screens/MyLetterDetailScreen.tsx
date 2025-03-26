import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, SafeAreaView } from 'react-native';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, useTheme } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LetterTitleCard from '../components/LetterTitleCard';

type Props = NativeStackScreenProps<RootStackParamList, 'MyLetterDetail'>;

const MyLetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionStats, setReactionStats] = useState<{emoji: string, count: number}[]>([]);
  const [replyCount, setReplyCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const fetchLetter = async () => {
    try {
      setLoading(true);
      
      // Fetch the letter details
      const { data: letterData, error: letterError } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .eq('id', letterId)
        .single();

      if (letterError) {
        console.error('Error fetching letter:', letterError);
        return;
      }

      if (letterData) {
        setLetter(letterData as LetterWithDetails);
        
        // Fetch stats about this letter
        fetchLetterStats();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const fetchLetterStats = async () => {
    if (!letterId) return;
    
    try {
      // Fetch reaction stats
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('reactions')
        .select('reaction_type, user_id')
        .eq('letter_id', letterId);
        
      if (reactionsError) {
        console.error('Error fetching reactions:', reactionsError);
      } else if (reactionsData) {
        // Process reactions to get counts
        const reactionCounts: {[key: string]: number} = {};
        
        reactionsData.forEach(reaction => {
          // Count total reactions by type
          reactionCounts[reaction.reaction_type] = (reactionCounts[reaction.reaction_type] || 0) + 1;
        });
        
        // Format for display
        const formattedReactions = Object.entries(reactionCounts).map(([emoji, count]) => ({
          emoji,
          count
        })).sort((a, b) => b.count - a.count);
        
        setReactionStats(formattedReactions);
      }
      
      // Fetch reply count
      const { data: repliesData, error: repliesError } = await supabase
        .from('replies')
        .select('id', { count: 'exact' })
        .eq('letter_id', letterId);
        
      if (repliesError) {
        console.error('Error fetching replies count:', repliesError);
      } else {
        setReplyCount(repliesData?.length || 0);
      }
      
      // Fetch read count
      const { data: readsData, error: readsError } = await supabase
        .from('letter_reads')
        .select('id', { count: 'exact' })
        .eq('letter_id', letterId);
        
      if (readsError) {
        console.error('Error fetching read count:', readsError);
      } else {
        setReadCount(readsData?.length || 0);
      }
      
    } catch (error) {
      console.error('Error processing letter stats:', error);
    }
  };

  useEffect(() => {
    fetchLetter();
  }, [letterId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetter();
  };
  
  const handleDeleteLetter = () => {
    // In a real implementation, this would delete the letter
    // For now, we'll just show a confirmation message
    alert('Delete letter functionality would go here');
  };
  
  const handleViewThreads = () => {
    // Navigate to see threads/conversations around this letter
    navigation.navigate('ThreadDetail', { letterId: letterId });
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error }}>Letter not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.onBackground} />
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleDeleteLetter} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <LetterTitleCard letter={letter} />

        <View style={styles.letterContent}>
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: theme.colors.primary }]}>
              By you
            </Text>
            <Text style={[styles.date, { color: theme.colors.onSurfaceDisabled }]}>
              {format(new Date(letter.created_at), 'MMM d, yyyy')}
            </Text>
          </View>

          <Paragraph style={[styles.content, { color: theme.colors.onSurface }]}>
            {letter.content}
          </Paragraph>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={20} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {readCount} reads
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {replyCount} replies
              </Text>
            </View>
          </View>
          
          {reactionStats.length > 0 && (
            <View style={styles.reactionsContainer}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                Reactions
              </Text>
              <View style={styles.reactionsList}>
                {reactionStats.map((reaction, index) => (
                  <View key={index} style={styles.reactionItem}>
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurfaceVariant }]}>
                      {reaction.count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      
      {replyCount > 0 && (
        <View style={[styles.bottomBar, { backgroundColor: theme.colors.surface }]}>
          <Button
            mode="contained"
            onPress={handleViewThreads}
            style={styles.viewThreadsButton}
          >
            View Conversations ({replyCount})
          </Button>
        </View>
      )}
    </SafeAreaView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    padding: 8,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  deleteButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  letterContent: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorName: {
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  statText: {
    marginLeft: 6,
    fontSize: 14,
  },
  reactionsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  reactionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reactionEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  reactionCount: {
    fontSize: 14,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  viewThreadsButton: {
    width: '100%',
  },
});

export default MyLetterDetailScreen; 