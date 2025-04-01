import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import CorrespondenceTab from './mailbox/CorrespondenceTab';
import MyLettersTab from './mailbox/MyLettersTab';
import { updateAppBadgeCount } from '../services/notifications';

const MailboxScreen = () => {
  const [activeTab, setActiveTab] = useState('correspondence');
  const [unreadCount, setUnreadCount] = useState(0);
  const theme = useTheme();
  
  // Update the app badge count whenever unreadCount changes
  useEffect(() => {
    console.log(`[MailboxScreen] Unread count changed to ${unreadCount}, updating app badge`);
    updateAppBadgeCount(unreadCount);
  }, [unreadCount]);

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
                My Responses
              </Text>
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, activeTab === 'correspondence' ? { backgroundColor: '#FFFFFF' } : { backgroundColor: 'red' }]}>
                  <Text style={[styles.unreadBadgeText, activeTab === 'correspondence' ? { color: theme.colors.primary } : { color: '#FFFFFF' }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
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
            <Text style={[
              styles.tabText, 
              activeTab === 'myLetters' ? { color: '#FFFFFF' } : { color: theme.colors.onSurface }
            ]}>
              My Mail
            </Text>
          </TouchableOpacity>
      </View>
      
      <View style={[styles.tabContent, { backgroundColor: theme.colors.background }]}>
        {activeTab === 'correspondence' ? 
          <CorrespondenceTab onUnreadCountChange={setUnreadCount} /> : 
          <MyLettersTab />}
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
    fontSize: 13,
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