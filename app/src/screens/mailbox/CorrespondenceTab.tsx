import React, { useState, useEffect, useCallback } from 'react';
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
  other_participant_id: string;
  other_participant_name?: string;
  letter_title: string;
  letter_author_id: string;
  most_recent_interaction_at: string;
  most_recent_interaction_content: string;
  most_recent_interactor_id: string;
  unread_message_count: number;
  category_name: string | null;
  category_color: string | null;
  mood_emoji: string | null;
};

type CorrespondenceTabProps = {
  onUnreadCountChange?: (count: number) => void;
};

const CorrespondenceTab = ({ onUnreadCountChange }: CorrespondenceTabProps) => {
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

      const { data, error } = await supabase.rpc(
        'get_user_correspondences_by_pair',
        { p_user_id: user.id }
      );

      if (error) {
        console.error('Error fetching correspondences:', error);
        setCorrespondences([]);
        return;
      }

      if (!data || data.length === 0) {
        setCorrespondences([]);
        return;
      }

      type CorrespondencePairResult = {
        letter_id: string;
        other_participant_id: string;
        letter_title: string;
        letter_author_id: string;
        letter_created_at: string;
        category_name: string | null;
        category_color: string | null;
        most_recent_interaction_at: string;
        most_recent_interaction_content: string;
        most_recent_interactor_id: string;
        unread_message_count: number;
        mood_emoji: string | null;
      };

      const otherParticipantIds = data.map((item: CorrespondencePairResult) => item.other_participant_id).filter((id: string | null): id is string => id !== null);
      const uniqueOtherParticipantIds = [...new Set(otherParticipantIds)];

      let participantNames: { [key: string]: string } = {};
      if (uniqueOtherParticipantIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', uniqueOtherParticipantIds);

        if (profilesError) {
          console.error('Error fetching participant profiles:', profilesError);
        } else if (profilesData) {
          participantNames = profilesData.reduce((acc: { [key: string]: string }, profile: { id: string; username: string | null }) => {
            acc[profile.id] = profile.username || 'Unknown User';
            return acc;
          }, {} as { [key: string]: string });
        }
      }

      const formattedCorrespondences = data.map((item: CorrespondencePairResult) => ({
        letter_id: item.letter_id,
        other_participant_id: item.other_participant_id,
        other_participant_name: participantNames[item.other_participant_id] || 'User',
        letter_title: item.letter_title,
        letter_author_id: item.letter_author_id,
        most_recent_interaction_at: item.most_recent_interaction_at,
        most_recent_interaction_content: item.most_recent_interaction_content.substring(0, 100) + (item.most_recent_interaction_content.length > 100 ? '...' : ''),
        most_recent_interactor_id: item.most_recent_interactor_id,
        unread_message_count: item.unread_message_count,
        category_name: item.category_name,
        category_color: item.category_color,
        mood_emoji: item.mood_emoji,
      }));

      setCorrespondences(formattedCorrespondences);

      const totalUnreadCount = formattedCorrespondences.reduce(
        (total: number, item: Correspondence) => total + item.unread_message_count, 0
      );
      onUnreadCountChange?.(totalUnreadCount);
    } catch (error) {
      console.error('Error:', error);
      setCorrespondences([]);
      onUnreadCountChange?.(0);
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
    navigation.navigate('ThreadDetail', {
      letterId: correspondence.letter_id,
      otherParticipantId: correspondence.other_participant_id,
    });
  };

  const renderCorrespondenceItem = ({ item }: { item: Correspondence }) => {
    const isUnread = item.unread_message_count > 0;
    const categoryColor = item.category_color || '#888888'; // Fallback color
    const categoryName = item.category_name || 'GENERAL'; // Fallback name
    const backgroundColor = `${categoryColor}33`; // 20% opacity
    // Use a better default emoji and ensure proper rendering
    const moodEmoji = item.mood_emoji ? item.mood_emoji : '📝';

    return (
      <Card
        style={[
          styles.card,
          {
            backgroundColor,
            borderWidth: 1,
            borderColor: categoryColor,
          },
          isUnread && styles.unreadCard, // Style applied conditionally
        ]}
        onPress={() => handleCorrespondencePress(item)}
      >
        <View style={styles.cardContainer}>
          {isUnread && <View style={styles.unreadIndicator} />} {/* Unread dot remains top-left */}
          <Card.Content style={styles.cardContent}>
            {/* Top Row: Emoji | Title | Category */}
            <View style={styles.topRow}>
              {/* Left: Emoji */}
              <View style={styles.emojiContainer}>
                <Text style={styles.emojiText}>{moodEmoji}</Text>
              </View>
              {/* Center: Title */}
              <View style={styles.titleContainer}>
                <Title
                  style={styles.letterTitle}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.letter_title}
                </Title>
              </View>
              {/* Right: Category */}
              <View style={[styles.categoryContainer, { backgroundColor: `${categoryColor}50` }]}>
                <Text style={styles.categoryNameText}>
                  {categoryName.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Bottom Row: Reply Preview and Date */}
            <View style={styles.bottomRow}>
              {/* Left Column: Reply Preview */}
              <View style={styles.replyPreviewContainer}>
                <Paragraph
                  style={styles.letterContent}
                  numberOfLines={2} 
                  ellipsizeMode="tail"
                >
                  {item.most_recent_interactor_id === item.other_participant_id ? (
                    <>
                      <Text style={styles.interactorName}>{item.other_participant_name}: </Text>
                      <Text>{item.most_recent_interaction_content}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.interactorName}>you: </Text>
                      <Text>{item.most_recent_interaction_content}</Text>
                    </>
                  )}
                </Paragraph>
              </View>
              
              {/* Right Column: Date */}
              <View style={styles.dateContainer}>
                <Text style={styles.dateText}>
                  {format(new Date(item.most_recent_interaction_at), 'MMM d')}
                </Text>
              </View>
            </View>

          </Card.Content>
        </View>
      </Card>
    );
  };

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
        keyExtractor={(item) => `${item.letter_id}-${item.other_participant_id}`}
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
    padding: 8,
    paddingBottom: 60, // Ensure space at the bottom for potential floating buttons
  },
  card: {
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },
  unreadCard: {
    elevation: 4,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6347',
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1,
  },
  cardContainer: {
    flexDirection: 'row',
    position: 'relative', // Needed for absolute positioning of unreadIndicator
  },
  cardContent: {
    flex: 1,
    padding: 10, // Reduce overall padding
    paddingVertical: 8, // Even less vertical padding
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Center items vertically in the top row
    marginBottom: 2, // Minimal space below the top row
  },
  emojiContainer: {
    width: 36, // Slightly wider for emoji
    height: 36, // Fixed height for consistent sizing
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 18, // Make it circular
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // 40% opacity white background
  },
  emojiText: {
    fontSize: 20, // Slightly larger emoji
    textAlign: 'center',
    paddingTop: 2, // Shift emoji 2px lower
  },
  titleContainer: {
    flex: 1, // Title takes remaining space between emoji and category
    marginHorizontal: 4, // Small margin around title
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Space between reply preview and date
    alignItems: 'center', // Vertically center items
    marginTop: 2, // Minimal space above the bottom row
  },
  replyPreviewContainer: {
    flex: 1, // Take up available space
    marginRight: 8, // Space between preview and date
  },
  dateContainer: {
    alignItems: 'flex-end', // Align date to the right
    alignSelf: 'center', // Center vertically in the row
    paddingBottom: 2, // Slight adjustment for visual centering
  },
  letterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 0, // Remove bottom margin
    color: '#FFFFFF',
    fontFamily: 'SourceCodePro-SemiBold',
    lineHeight: 16,
    letterSpacing: -1,
  },
  letterContent: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 0, // Remove top margin
  },
  interactorName: {
    color: '#CCCCCC',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  categoryContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8, // Space between title and category
  },
  categoryNameText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default CorrespondenceTab;