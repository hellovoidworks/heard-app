import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button, useTheme } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Correspondence = {
  letter_id: string;
  title: string;
  content_preview: string;
  mostRecentActivityDate: string;
  unread_count: number;
  participants: string[];
};

const CorrespondenceTab = () => {
  const [correspondences, setCorrespondences] = useState<Correspondence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const fetchCorrespondences = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // First, get all letters authored by the current user
      const { data: authoredLetters, error: letterError } = await supabase
        .from('letters')
        .select('id, title, content, created_at, author_id')
        .eq('author_id', user.id);

      if (letterError) {
        console.error('Error fetching authored letters:', letterError);
        return;
      }

      // Get the unique letter IDs authored by the user
      const authoredLetterIds = authoredLetters ? authoredLetters.map(letter => letter.id) : [];
      
      // Next, get all replies by the current user to find letters they've replied to
      const { data: myReplies, error: myRepliesError } = await supabase
        .from('replies')
        .select('letter_id, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });
        
      if (myRepliesError) {
        console.error('Error fetching user replies:', myRepliesError);
        return;
      }
      
      // Create a map of letter_id to user's most recent reply date
      const userReplyDatesMap = new Map<string, string>();
      if (myReplies) {
        myReplies.forEach(reply => {
          // Only set if this is the most recent reply (they're ordered by created_at desc)
          if (!userReplyDatesMap.has(reply.letter_id)) {
            userReplyDatesMap.set(reply.letter_id, reply.created_at);
          }
        });
      }
      
      // Extract unique letter IDs from replies (letters the user has replied to)
      const repliedToLetterIds = [...userReplyDatesMap.keys()];
      
      // Get letters the user has reacted to
      const { data: myReactions, error: reactionsError } = await supabase
        .from('reactions')
        .select('letter_id, reaction_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (reactionsError) {
        console.error('Error fetching user reactions:', reactionsError);
        return;
      }
      
      // Create a map of letter_id to user's most recent reaction date
      const userReactionDatesMap = new Map<string, string>();
      if (myReactions) {
        myReactions.forEach(reaction => {
          // Only set if this is the most recent reaction
          if (!userReactionDatesMap.has(reaction.letter_id)) {
            userReactionDatesMap.set(reaction.letter_id, reaction.created_at);
          }
        });
      }
      
      // Extract unique letter IDs from reactions (letters the user has reacted to)
      const reactedToLetterIds = [...userReactionDatesMap.keys()];
      
      // Get details of letters the user has replied to or reacted to (that they did not author)
      const interactedLetterIds = [...new Set([...repliedToLetterIds, ...reactedToLetterIds])];
      
      const { data: interactedLetters, error: interactedLettersError } = await supabase
        .from('letters')
        .select('id, title, content, created_at, author_id')
        .in('id', interactedLetterIds)
        .not('author_id', 'eq', user.id);  // Exclude letters the user authored
        
      if (interactedLettersError) {
        console.error('Error fetching interacted letters:', interactedLettersError);
        return;
      }
      
      // Combine both sets of letters
      const allRelevantLetters = [
        ...(authoredLetters || []),
        ...(interactedLetters || [])
      ];
      
      if (allRelevantLetters.length === 0) {
        setCorrespondences([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get the complete set of letter IDs to work with
      const allLetterIds = allRelevantLetters.map(letter => letter.id);

      // Fetch all replies for each letter (from any user)
      const { data: replyData, error: replyError } = await supabase
        .from('replies')
        .select(`
          id, 
          letter_id, 
          content,
          author_id,
          created_at
        `)
        .in('letter_id', allLetterIds)
        .order('created_at', { ascending: false });

      if (replyError) {
        console.error('Error fetching replies:', replyError);
        return;
      }

      // Fetch all reactions for each letter (from any user)
      const { data: allReactions, error: allReactionsError } = await supabase
        .from('reactions')
        .select(`
          letter_id,
          reaction_type,
          user_id,
          created_at
        `)
        .in('letter_id', allLetterIds)
        .order('created_at', { ascending: false });

      if (allReactionsError) {
        console.error('Error fetching all reactions:', allReactionsError);
      }

      // Get count of unread replies
      const { data: unreadCounts, error: unreadError } = await supabase.rpc(
        'get_unread_reply_count',
        { p_user_id: user.id, p_letter_ids: allLetterIds }
      );

      if (unreadError) {
        console.error('Error fetching unread counts:', unreadError);
      }

      // Create a map for unread counts
      const unreadCountMap = new Map<string, number>();
      if (unreadCounts) {
        unreadCounts.forEach((item: { letter_id: string, unread_count: number }) => {
          unreadCountMap.set(item.letter_id, item.unread_count);
        });
      }

      // Group replies by letter_id
      const letterRepliesMap = new Map<string, Array<any>>();
      if (replyData) {
        replyData.forEach(reply => {
          if (!letterRepliesMap.has(reply.letter_id)) {
            letterRepliesMap.set(reply.letter_id, []);
          }
          letterRepliesMap.get(reply.letter_id)!.push(reply);
        });
      }

      // Group reactions by letter_id
      const letterReactionsMap = new Map<string, Array<any>>();
      if (allReactions) {
        allReactions.forEach(reaction => {
          if (!letterReactionsMap.has(reaction.letter_id)) {
            letterReactionsMap.set(reaction.letter_id, []);
          }
          letterReactionsMap.get(reaction.letter_id)!.push(reaction);
        });
      }

      // Find most recent activity date (reply or reaction) for each letter
      const mostRecentActivityMap = new Map<string, string>();
      const mostRecentContentMap = new Map<string, string>();
      
      // Initialize with letter creation dates and content
      allRelevantLetters.forEach(letter => {
        mostRecentActivityMap.set(letter.id, letter.created_at);
        mostRecentContentMap.set(letter.id, letter.content);
      });
      
      // Update with most recent reply dates and content if newer
      if (replyData) {
        // Group by letter and find the most recent
        const replyDateMap = new Map<string, {date: string, content: string}>();
        replyData.forEach(reply => {
          const current = replyDateMap.get(reply.letter_id);
          if (!current || new Date(reply.created_at) > new Date(current.date)) {
            replyDateMap.set(reply.letter_id, {
              date: reply.created_at,
              content: reply.content
            });
          }
        });
        
        // Update the activity and content maps if reply is more recent
        replyDateMap.forEach((data, letterId) => {
          const currentActivityDate = mostRecentActivityMap.get(letterId);
          if (currentActivityDate && new Date(data.date) > new Date(currentActivityDate)) {
            mostRecentActivityMap.set(letterId, data.date);
            mostRecentContentMap.set(letterId, data.content);
          }
        });
      }
      
      // Update with most recent reaction dates and create reaction content if newer
      if (allReactions) {
        // Group by letter and find the most recent
        const reactionDateMap = new Map<string, {date: string, reactionType: string, userId: string}>();
        allReactions.forEach(reaction => {
          const current = reactionDateMap.get(reaction.letter_id);
          if (!current || new Date(reaction.created_at) > new Date(current.date)) {
            reactionDateMap.set(reaction.letter_id, {
              date: reaction.created_at,
              reactionType: reaction.reaction_type,
              userId: reaction.user_id
            });
          }
        });
        
        // Update the activity and content maps if reaction is more recent
        reactionDateMap.forEach((data, letterId) => {
          const currentActivityDate = mostRecentActivityMap.get(letterId);
          if (currentActivityDate && new Date(data.date) > new Date(currentActivityDate)) {
            mostRecentActivityMap.set(letterId, data.date);
            // Create a reaction content message
            const isCurrentUser = data.userId === user.id;
            const reactionMessage = isCurrentUser 
              ? `You reacted with ${data.reactionType}`
              : `Someone reacted with ${data.reactionType}`;
            mostRecentContentMap.set(letterId, reactionMessage);
          }
        });
      }

      // Format correspondences for each letter with replies
      const formattedCorrespondences = allRelevantLetters
        .filter(letter => {
          // Include letters authored by the user that have received replies
          if (letter.author_id === user.id) {
            return letterRepliesMap.has(letter.id);
          }
          // Include letters authored by others that the user has replied to or reacted to
          return letterRepliesMap.has(letter.id) || reactedToLetterIds.includes(letter.id);
        })
        .map(letter => {
          const replies = letterRepliesMap.get(letter.id) || [];
          const participants = new Set<string>();
          
          participants.add(letter.author_id);
          replies.forEach(reply => participants.add(reply.author_id));
          
          // Get the most recent activity date for this letter (from any user)
          const mostRecentActivityDate = mostRecentActivityMap.get(letter.id) || letter.created_at;
          
          // Get the most recent content (from letter, reply or reaction)
          const contentPreview = mostRecentContentMap.get(letter.id) || letter.content;
          
          return {
            letter_id: letter.id,
            title: letter.title,
            content_preview: contentPreview.substring(0, 100) + (contentPreview.length > 100 ? '...' : ''),
            mostRecentActivityDate: mostRecentActivityDate,
            unread_count: unreadCountMap.get(letter.id) || 0,
            participants: Array.from(participants) as string[],
          };
        })
        // Sort by the most recent activity date by any user (reply or reaction)
        .sort((a, b) => new Date(b.mostRecentActivityDate).getTime() - new Date(a.mostRecentActivityDate).getTime());

      setCorrespondences(formattedCorrespondences);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCorrespondences();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCorrespondences();
  };

  const handleCorrespondencePress = (correspondence: Correspondence) => {
    // Navigate to the thread detail screen with the letter ID
    navigation.navigate('ThreadDetail', { letterId: correspondence.letter_id });
  };

  const renderCorrespondenceItem = ({ item }: { item: Correspondence }) => (
    <Card 
      style={[
        styles.card, 
        { backgroundColor: theme.colors.surface },
        item.unread_count > 0 && [styles.unreadCard, { backgroundColor: theme.colors.elevation.level2 }]
      ]} 
      onPress={() => handleCorrespondencePress(item)}
    >
      <Card.Content>
        <View style={styles.titleRow}>
          <Title 
            style={{ 
              color: theme.colors.onSurface,
              fontSize: 16,
              lineHeight: 20,
              fontWeight: '600',
              flex: 1,
              marginRight: 8
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.title}
          </Title>
          <Text style={{ color: theme.colors.onSurfaceDisabled, fontSize: 12 }}>
            {format(new Date(item.mostRecentActivityDate), 'MMM d')}
          </Text>
        </View>
        <Paragraph 
          style={{ color: theme.colors.onSurface }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item.content_preview}
        </Paragraph>
        <View style={styles.cardFooter}>
          <View />
          {item.unread_count > 0 && (
            <Chip mode="flat" style={{ backgroundColor: theme.colors.primary }}>
              {item.unread_count} new
            </Chip>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={correspondences}
        renderItem={renderCorrespondenceItem}
        keyExtractor={(item) => item.letter_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={{ color: theme.colors.onBackground }}>No conversations yet</Text>
          </View>
        )}
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
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#BB86FC',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default CorrespondenceTab; 