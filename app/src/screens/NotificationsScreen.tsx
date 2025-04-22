import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, List, Divider, ActivityIndicator, Badge, useTheme } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Notification, NotificationWithDetails } from '../types/database.types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format, formatDistanceToNow } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<NotificationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:user_profiles!notifications_sender_id_fkey(*),
          letter:letters(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        setNotifications(data as NotificationWithDetails[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleNotificationPress = async (notification: NotificationWithDetails) => {
    // Mark notification as read
    if (!notification.read) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id);
        
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on notification type
    if (notification.letter_id) {
      if (notification.type === 'reaction') {
        // For reaction notifications, navigate to MyLetterDetail with modal presentation
        // Also pass the reaction_type from the notification data to animate it
        navigation.navigate('MyLetterDetail', { 
          letterId: notification.letter_id,
          presentationMode: 'modal',
          reactionEmoji: notification.data?.reaction_type
        });
      } else {
        // For other notification types, navigate to LetterDetail
        navigation.navigate('LetterDetail', { letterId: notification.letter_id });
      }
    }
  };

  const renderNotificationItem = ({ item }: { item: NotificationWithDetails }) => {
    let icon = 'email';
    let title = 'New notification';
    let description = '';

    if (item.type === 'reply') {
      icon = 'reply';
      title = `${item.sender?.username || 'Someone'} replied to your letter`;
      description = item.letter?.title || 'A letter';
    } else if (item.type === 'reaction') {
      icon = 'heart';
      title = `${item.sender?.username || 'Someone'} reacted to your letter`;
      description = item.letter?.title || 'A letter';
    }

    return (
      <List.Item
        title={title}
        description={description}
        titleStyle={{ color: theme.colors.onSurface }}
        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
        left={props => (
          <View style={styles.iconContainer}>
            <List.Icon {...props} icon={icon} color={theme.colors.primary} />
            {!item.read && <Badge size={8} style={styles.badge} />}
          </View>
        )}
        right={props => (
          <Text style={[styles.time, { color: theme.colors.onSurfaceDisabled }]}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        )}
        onPress={() => handleNotificationPress(item)}
        style={[
          styles.item, 
          !item.read && [styles.unreadItem, { backgroundColor: theme.colors.primaryContainer }]
        ]}
      />
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
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider style={{ backgroundColor: theme.colors.outline }} />}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceDisabled }]}>
              No notifications yet
            </Text>
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
  item: {
    paddingVertical: 8,
  },
  unreadItem: {
    // Background color will be set with theme in the component
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#6200ee', // This will be primary color
  },
  time: {
    fontSize: 12,
    alignSelf: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  emptyText: {
    fontSize: 16,
  },
});

export default NotificationsScreen; 