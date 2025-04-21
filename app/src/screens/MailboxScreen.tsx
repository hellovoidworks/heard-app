import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import CorrespondenceTab from './mailbox/CorrespondenceTab';
import MyLettersTab from './mailbox/MyLettersTab';
import { useNotification } from '../contexts/NotificationContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MailboxScreen = () => {
  const [activeTab, setActiveTab] = useState('correspondence');
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  
  // Use the notification context instead of local state
  const { 
    unreadMessagesCount, 
    unreadReactionsCount, 
    totalUnreadCount,
    setUnreadMessagesCount,
    setUnreadReactionsCount
  } = useNotification();
  
  // Update the navigation params whenever the total unread count changes
  useEffect(() => {
    console.log(`[MailboxScreen] Total unread count: ${totalUnreadCount} (messages: ${unreadMessagesCount}, reactions: ${unreadReactionsCount})`);
    
    // Expose the total unread count to the navigation
    if (navigation && navigation.setParams) {
      navigation.setParams({ unreadCount: totalUnreadCount });
    }
  }, [unreadMessagesCount, unreadReactionsCount, totalUnreadCount, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.tabBar, { backgroundColor: '#222222' }]}>
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'correspondence' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]} 
            onPress={() => setActiveTab('correspondence')}
          >
            <View style={styles.tabTextContainer}>
              <Text style={[
                styles.tabText, 
                activeTab === 'correspondence' ? { color: '#FFFFFF' } : { color: theme.colors.onSurface }
              ]}>
                Inbox
              </Text>
              {unreadMessagesCount > 0 && (
                <View style={[styles.unreadBadge, activeTab === 'correspondence' ? { backgroundColor: '#FFFFFF' } : { backgroundColor: 'red' }]}>
                  <Text style={[styles.unreadBadgeText, activeTab === 'correspondence' ? { color: theme.colors.primary } : { color: '#FFFFFF' }]}>
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'myLetters' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]} 
            onPress={() => setActiveTab('myLetters')}
          >
            <View style={styles.tabTextContainer}>
              <Text style={[
                styles.tabText, 
                activeTab === 'myLetters' ? { color: '#FFFFFF' } : { color: theme.colors.onSurface }
              ]}>
                My Mail
              </Text>
              {unreadReactionsCount > 0 && (
                <View style={[styles.unreadBadge, activeTab === 'myLetters' ? { backgroundColor: '#FFFFFF' } : { backgroundColor: 'red' }]}>
                  <Text style={[styles.unreadBadgeText, activeTab === 'myLetters' ? { color: theme.colors.primary } : { color: '#FFFFFF' }]}>
                    {unreadReactionsCount > 99 ? '99+' : unreadReactionsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
      </View>
      
      <View style={[styles.tabContent, { backgroundColor: theme.colors.background }]}>
        {activeTab === 'correspondence' ? 
          <CorrespondenceTab onUnreadCountChange={setUnreadMessagesCount} /> : 
          <MyLettersTab onUnreadReactionsCountChange={setUnreadReactionsCount} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#222222',
    borderRadius: 25,
    padding: 4,
    margin: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeTab: {
    // Pill style active indicator
  },
  tabTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontWeight: '500',
    fontSize: 15,
  },
  unreadBadge: {
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  tabContent: {
    flex: 1,
  },
});

export default MailboxScreen; 