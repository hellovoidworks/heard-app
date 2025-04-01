import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, SafeAreaView, FlatList } from 'react-native';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, useTheme, Divider } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails, ReplyWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LetterTitleCard from '../components/LetterTitleCard';

type Props = NativeStackScreenProps<RootStackParamList, 'MyLetterDetail'>;

type Thread = {
  id: string;
  replierId: string;
  latestReplyDate: string;
  latestReplyContent: string;
  replyCount: number;
  replierName: string;
};

const MyLetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionStats, setReactionStats] = useState<{emoji: string, count: number}[]>([]);
  const [replyCount, setReplyCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [threads, setThreads] = useState<Thread[]>([]);
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
        
        // Fetch threads with at least one reply
        fetchThreads();
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

  const fetchThreads = async () => {
    if (!letterId || !user) return;
    
    try {
      // Fetch all replies for this letter
      const { data: repliesData, error: repliesError } = await supabase
        .from('replies')
        .select(`
          id,
          letter_id,
          author_id,
          display_name,
          content,
          created_at,
          reply_to_id,
          reply_to_user_id,
          updated_at
        `)
        .eq('letter_id', letterId)
        .order('created_at', { ascending: true });
        
      if (repliesError) {
        console.error('Error fetching replies:', repliesError);
        return;
      }
      
      if (repliesData && repliesData.length > 0) { 
        // Create a map to track unique conversations by participant
        const conversationsByParticipant: { [participantId: string]: ReplyWithDetails[] } = {};
        
        // Group replies into conversations between the letter author (current user) and each participant
        repliesData.forEach(reply => {
          let participantId: string;
          
          // Determine the conversation participant (the person who's not the current user)
          if (reply.author_id === user.id) {
            // If current user wrote this reply, the participant is who they replied to
            participantId = reply.reply_to_user_id;
          } else {
            // If someone else wrote this reply to the current user, the participant is the author
            participantId = reply.author_id;
          }
          
          // Only include replies that are part of a conversation with the current user
          if (reply.author_id === user.id || reply.reply_to_user_id === user.id) {
            if (!conversationsByParticipant[participantId]) {
              conversationsByParticipant[participantId] = [];
            }
            conversationsByParticipant[participantId].push(reply);
          }
        });

        // Create a thread summary for each conversation participant
        const processedThreads: Thread[] = Object.entries(conversationsByParticipant).map(([participantId, participantReplies]) => {
          const latestReply = participantReplies[participantReplies.length - 1]; // Last one is latest due to ascending order
          return {
            id: `${letterId}-${participantId}`, // Unique key for the list item
            replierId: participantId,
            latestReplyDate: latestReply.created_at,
            latestReplyContent: latestReply.content,
            replyCount: participantReplies.length,
            replierName: participantReplies.find(r => r.author_id === participantId)?.display_name || 'User', // Use display name from participant's reply
          };
        });

        // Sort threads by the latest reply date, newest first
        processedThreads.sort((a, b) => new Date(b.latestReplyDate).getTime() - new Date(a.latestReplyDate).getTime());

        setThreads(processedThreads);
      } else {
        setThreads([]);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
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
  
  // Updated function to navigate to the specific thread with a participant
  const navigateToThread = (participantId: string) => {
    navigation.navigate('ThreadDetail', { 
      letterId: letterId, 
      otherParticipantId: participantId // Pass the specific replier ID
    });
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
          
          {threads.length > 0 && (
            <View style={styles.threadsContainer}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                Conversations
              </Text>
              <FlatList
                data={threads}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => ( // Pass replierId to navigateToThread
                  <TouchableOpacity onPress={() => navigateToThread(item.replierId)}>
                    <Card style={styles.threadCard}>
                      <Card.Content>
                        <View style={styles.threadHeader}>
                          <Text style={[styles.threadReplier, { color: theme.colors.primary }]}>
                            {item.replierName}
                          </Text>
                          <Text style={[styles.threadDate, { color: theme.colors.onSurfaceDisabled }]}>
                            {format(new Date(item.latestReplyDate), 'MMM d, yyyy')}
                          </Text>
                        </View>
                        <Text 
                          style={[styles.threadPreview, { color: theme.colors.onSurfaceVariant }]} 
                          numberOfLines={2}
                        >
                          {item.latestReplyContent}
                        </Text>
                        <View style={styles.threadFooter}>
                          <Text style={[styles.replyCount, { color: theme.colors.onSurfaceDisabled }]}>
                            {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
                          </Text>
                        </View>
                      </Card.Content>
                    </Card>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
          
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
  threadsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  threadCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  threadReplier: {
    fontWeight: '600',
    fontSize: 14,
  },
  threadDate: {
    fontSize: 12,
  },
  threadPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  replyCount: {
    fontSize: 12,
  },
});

export default MyLetterDetailScreen; 