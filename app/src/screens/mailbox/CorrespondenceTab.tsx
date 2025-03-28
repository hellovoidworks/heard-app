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
      };

      // Format the correspondences from the RPC result
      const formattedCorrespondences = data.map((item: CorrespondenceResult) => ({
        letter_id: item.letter_id,
        title: item.title,
        content_preview: item.most_recent_content.substring(0, 100) + (item.most_recent_content.length > 100 ? '...' : ''),
        mostRecentActivityDate: item.most_recent_activity_date,
        unread_count: item.unread_count,
        participants: item.participants,
      }));

      setCorrespondences(formattedCorrespondences);
    } catch (error) {
      console.error('Error:', error);
      setCorrespondences([]);
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