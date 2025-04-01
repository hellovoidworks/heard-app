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
        most_recent_interaction_at: string;
        most_recent_interaction_content: string;
        most_recent_interactor_id: string;
        unread_message_count: number;
      };

      const otherParticipantIds = data.map((item: CorrespondencePairResult) => item.other_participant_id).filter((id): id is string => id !== null);
      const uniqueOtherParticipantIds = [...new Set(otherParticipantIds)];

      let participantNames: { [key: string]: string } = {};
      if (uniqueOtherParticipantIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', uniqueOtherParticipantIds);

        if (profilesError) {
          console.error('Error fetching participant profiles:', profilesError);
        } else if (profilesData) { // Add explicit types for profile and accumulator
          participantNames = profilesData.reduce((acc: { [key: string]: string }, profile: { id: string; username: string | null }) => {
            acc[profile.id] = profile.username || 'Unknown User'; // Fallback name
            return acc;
          }, {} as { [key: string]: string });
        }
      }

      const formattedCorrespondences = data.map((item: CorrespondencePairResult) => ({
        letter_id: item.letter_id,
        other_participant_id: item.other_participant_id,
        other_participant_name: participantNames[item.other_participant_id] || 'User', // Use fetched name
        letter_title: item.letter_title,
        letter_author_id: item.letter_author_id,
        most_recent_interaction_at: item.most_recent_interaction_at,
        most_recent_interaction_content: item.most_recent_interaction_content.substring(0, 100) + (item.most_recent_interaction_content.length > 100 ? '...' : ''),
        most_recent_interactor_id: item.most_recent_interactor_id,
        unread_message_count: item.unread_message_count,
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
    const categoryColor = '#CCCCCC';
    const backgroundColor = `${categoryColor}33`;

    return (
      <Card 
        style={[
          styles.card, 
          { 
            backgroundColor,
            borderWidth: 1,
            borderColor: categoryColor 
          },
          isUnread && styles.unreadCard
        ]} 
        onPress={() => handleCorrespondencePress(item)}
      >
        <View style={styles.cardContainer}>
          {isUnread && <View style={styles.unreadIndicator} />}
          <Card.Content style={styles.cardContent}>
            <View style={styles.threeColumnLayout}>
              <View style={styles.leftColumn}>
              </View>
              <View style={styles.centerColumn}>
                <Title 
                  style={styles.letterTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.letter_title}
                </Title>
                <Text style={styles.participantName}>
                  Conversation with: {item.other_participant_name}
                </Text>
                <Paragraph 
                  style={styles.letterContent}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.most_recent_interaction_content}
                </Paragraph>
              </View>
              <View style={styles.rightColumn}>
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
    padding: 16,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },
  unreadCard: {
    elevation: 4,
  },
  cardContainer: {
    position: 'relative',
  },
  cardContent: {
    padding: 16,
    paddingTop: 24,
  },
  threeColumnLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftColumn: {
    marginRight: 8,
    width: 24,
    alignSelf: 'center',
  },
  centerColumn: {
    flex: 1,
    overflow: 'hidden',
  },
  rightColumn: {
    marginLeft: 8,
    width: 75,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  letterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#FFFFFF',
    lineHeight: 16,
    letterSpacing: -1,
  },
  participantName: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  letterContent: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 8,
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default CorrespondenceTab;