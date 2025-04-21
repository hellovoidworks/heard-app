import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, useTheme } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';
import { fontNames } from '../../utils/fonts';
import { useDataWithCache } from '../../hooks/useDataWithCache';
import dataCache from '../../utils/dataCache';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Correspondence = {
  letter_id: string;
  other_participant_id: string;
  other_participant_name?: string;
  letter_title: string;
  letter_author_id: string;
  letter_display_name?: string;
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
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  // Define the fetch function that will be used by our hook
  const fetchCorrespondences = useCallback(async (): Promise<Correspondence[]> => {
    if (!user) return [];

    console.log(`[CorrespondenceTab] Fetching correspondences for user: ${user.id}`);
    const { data, error } = await supabase.rpc(
      'get_user_correspondences_by_pair',
      { p_user_id: user.id }
    );

    if (error) {
      console.error('[CorrespondenceTab] Error fetching correspondences:', error);
      return [];
    }
    
    // Log the raw data returned from the function
    console.log(`[CorrespondenceTab] Raw data from SQL function:`, JSON.stringify(data?.slice(0, 2)));
    if (data && data.length > 0) {
      // Log the first correspondence to see all available fields
      console.log(`[CorrespondenceTab] First correspondence fields:`, Object.keys(data[0]).join(', '));
    }

    if (!data || data.length === 0) {
      return [];
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
      letter_display_name: string | null;
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

    return data.map((item: CorrespondencePairResult) => {
      // Log the letter_display_name from the raw data
      if (item.most_recent_interactor_id === item.letter_author_id) {
        console.log(`[CorrespondenceTab] Raw letter_display_name for letter ${item.letter_id}:`, item.letter_display_name);
      }
      
      return {
        letter_id: item.letter_id,
        other_participant_id: item.other_participant_id,
        other_participant_name: participantNames[item.other_participant_id] || 'User',
        letter_title: item.letter_title,
        letter_author_id: item.letter_author_id,
        letter_display_name: item.letter_display_name, // Include the letter_display_name field
        most_recent_interaction_at: item.most_recent_interaction_at,
        most_recent_interaction_content: item.most_recent_interaction_content.substring(0, 100) + (item.most_recent_interaction_content.length > 100 ? '...' : ''),
        most_recent_interactor_id: item.most_recent_interactor_id,
        unread_message_count: item.unread_message_count,
        category_name: item.category_name,
        category_color: item.category_color,
        mood_emoji: item.mood_emoji,
      };
    });
  }, [user, onUnreadCountChange]);

  // Handler for when data is loaded - update the unread count badge
  const handleDataLoaded = useCallback((correspondences: Correspondence[]) => {
    // Count total unread messages
    const totalUnreadCount = correspondences.reduce(
      (total: number, item: Correspondence) => total + item.unread_message_count, 0
    );
    
    // Update the badge count
    onUnreadCountChange?.(totalUnreadCount);
  }, [onUnreadCountChange]);

  // Use our custom hook for data fetching with cache
  const {
    data: correspondences = [],
    initialLoading,
    refreshing,
    handleRefresh,
    handleFocus
  } = useDataWithCache<Correspondence[]>({
    cacheKey: dataCache.CACHE_KEYS.CORRESPONDENCES,
    fetchFunction: fetchCorrespondences,
    initialData: [],
    onDataLoaded: handleDataLoaded
  });

  // Register focus effect to handle tab focus
  useFocusEffect(
    useCallback(() => {
      console.log('[CorrespondenceTab] Screen focused');
      handleFocus(); // Use our hook's focus handler to refresh in background
    }, [handleFocus])
  );

  const handleCorrespondencePress = (correspondence: Correspondence) => {
    console.log(`[CorrespondenceTab] Navigating to ThreadDetail. letterId: ${correspondence.letter_id}, otherParticipantId: ${correspondence.other_participant_id}`);
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
          isUnread && styles.unreadCard
        ]}
        onPress={() => handleCorrespondencePress(item)}
      >
        <View style={styles.cardContainer}>
          {isUnread && <View style={styles.unreadIndicator} />}
          <Card.Content style={styles.cardContent}>
            <View style={styles.topRow}>
              <View style={[styles.emojiContainer, { backgroundColor: `${categoryColor}66` }]}>
                <Text style={styles.emojiText}>{moodEmoji}</Text>
              </View>
              <View style={styles.titleContainer}>
                <Title
                  style={styles.letterTitle}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.letter_title}
                </Title>
              </View>
              <View style={[styles.categoryContainer, { backgroundColor: `${categoryColor}50` }]}>
                <Text style={styles.categoryNameText}>
                  {categoryName.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.replyPreviewContainer}>
                <Paragraph
                  style={styles.letterContent}
                  numberOfLines={2} 
                  ellipsizeMode="tail"
                >
                  {item.most_recent_interactor_id === item.other_participant_id ? (
                    <>
                      <Text style={styles.interactorName}>
                        {item.most_recent_interactor_id === item.letter_author_id 
                          ? `${item.letter_display_name || item.other_participant_name}: ` 
                          : `${item.other_participant_name}: `}
                      </Text>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {initialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : correspondences.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={correspondences}
          renderItem={renderCorrespondenceItem}
          keyExtractor={(item) => `${item.letter_id}-${item.other_participant_id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}
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
    paddingVertical: 16, // Increased vertical padding for better spacing
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 0, // Remove bottom margin
    color: '#FFFFFF',
    fontFamily: fontNames.interSemiBold,
    lineHeight: 18,
    letterSpacing: 0,
  },
  letterContent: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 0, // Remove top margin
    lineHeight: 18,
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
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: fontNames.interSemiBold,
    opacity: 0.9,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 20,
  },
});

export default CorrespondenceTab;