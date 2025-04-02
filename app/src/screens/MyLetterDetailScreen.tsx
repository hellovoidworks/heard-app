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
import ReactionDisplay from '../components/ReactionDisplay';

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
  const [reactionStats, setReactionStats] = useState<{emoji: string, username: string, date: string}[]>([]);
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
      // Define the type for the reaction data
      type ReactionWithUser = {
        reaction_type: string;
        created_at: string;
        user_profiles: { username: string } | null;
      };

      // Fetch reaction stats with user information
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('reactions')
        .select(`
          reaction_type, 
          created_at,
          user_profiles!reactions_user_id_fkey(username)
        `)
        .eq('letter_id', letterId)
        .order('created_at', { ascending: false }) as { data: ReactionWithUser[] | null, error: any };
        
      if (reactionsError) {
        console.error('Error fetching reactions:', reactionsError);
      } else if (reactionsData && reactionsData.length > 0) {
        // Format reactions for display with usernames
        const formattedReactions = reactionsData.map(reaction => ({
          emoji: reaction.reaction_type,
          username: reaction.user_profiles?.username || 'Anonymous',
          date: format(new Date(reaction.created_at), 'MMM d')
        }));
        
        setReactionStats(formattedReactions);
      } else {
        setReactionStats([]);
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
        
        <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>My Mail</Text>
        
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
        
        {reactionStats.length > 0 && (
          <View style={styles.reactionsContainer}>
            {reactionStats.map((reaction, index) => (
              <ReactionDisplay
                key={index}
                username={reaction.username}
                emoji={reaction.emoji}
                date={reaction.date}
                isCurrentUser={false}
              />
            ))}
          </View>
        )}

        <View style={styles.letterContent}>

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
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
    marginTop: 8,
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
    marginTop: 0,
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
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  reactionsList: {
    flexDirection: 'column',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  reactionText: {
    fontSize: 14,
    fontStyle: 'italic',
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