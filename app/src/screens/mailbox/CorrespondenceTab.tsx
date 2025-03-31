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
  title: string;
  content_preview: string;
  mostRecentActivityDate: string;
  unread_count: number;
  participants: string[];
  category_id?: string;
  category_name?: string;
  category_color?: string;
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

      // Use the consolidated RPC function to fetch all correspondence data in a single query
      const { data, error } = await supabase.rpc(
        'get_user_correspondences',
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

      // Define the type for the RPC function result
      type CorrespondenceResult = {
        letter_id: string;
        title: string;
        content: string;
        created_at: string;
        author_id: string;
        most_recent_activity_date: string;
        most_recent_content: string;
        unread_count: number;
        participants: string[];
        category_id?: string;
        category_name?: string;
        category_color?: string;
      };

      // Format the correspondences from the RPC result
      const formattedCorrespondences = data.map((item: CorrespondenceResult) => ({
        letter_id: item.letter_id,
        title: item.title,
        content_preview: item.most_recent_content.substring(0, 100) + (item.most_recent_content.length > 100 ? '...' : ''),
        mostRecentActivityDate: item.most_recent_activity_date,
        unread_count: item.unread_count,
        participants: item.participants,
        category_id: item.category_id,
        category_name: item.category_name,
        category_color: item.category_color,
      }));

      setCorrespondences(formattedCorrespondences);
      
      // Calculate total unread count and notify parent component
      const totalUnreadCount = formattedCorrespondences.reduce(
        (total: number, item: Correspondence) => total + item.unread_count, 0
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
    // Navigate to the thread detail screen with the letter ID
    navigation.navigate('ThreadDetail', { letterId: correspondence.letter_id });
  };

  const renderCorrespondenceItem = ({ item }: { item: Correspondence }) => {
    const isUnread = item.unread_count > 0;
    const categoryColor = item.category_color || '#FFFFFF';
    // Use category color with opacity 0.2 for background
    const backgroundColor = `${categoryColor}33`; // 20% opacity

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
              {/* Left column: Empty or could be used for an icon */}
              <View style={styles.leftColumn}>
              </View>
              
              {/* Center column: Title and content preview */}
              <View style={styles.centerColumn}>
                <Title 
                  style={styles.letterTitle}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.title}
                </Title>
                <Paragraph 
                  style={styles.letterContent}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.content_preview}
                </Paragraph>
              </View>
              
              {/* Right column: Date and category */}
              <View style={styles.rightColumn}>
                <Text style={styles.dateText}>
                  {format(new Date(item.mostRecentActivityDate), 'MMM d')}
                </Text>
                {item.category_name && (
                  <View style={[styles.categoryContainer, { backgroundColor: `${categoryColor}66` }]}>
                    <Text style={styles.categoryName}>
                      {item.category_name.toUpperCase()}
                    </Text>
                  </View>
                )}
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
    paddingTop: 24, // Add extra top padding to create space from the unread indicator
  },
  unreadIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
    zIndex: 1,
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#FFFFFF',
    lineHeight: 16,
    letterSpacing: -1,
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