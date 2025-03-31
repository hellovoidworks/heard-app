import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import CorrespondenceTab from './mailbox/CorrespondenceTab';
import MyLettersTab from './mailbox/MyLettersTab';

const MailboxScreen = () => {
  const [activeTab, setActiveTab] = useState('correspondence');
  const [unreadCount, setUnreadCount] = useState(0);
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'correspondence' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]
          ]} 
          onPress={() => setActiveTab('correspondence')}
        >
          <View style={styles.tabTextContainer}>
            <Text style={[
              styles.tabText, 
              { color: theme.colors.onSurface },
              activeTab === 'correspondence' && { color: theme.colors.primary }
            ]}>
              My Responses
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'myLetters' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]
          ]} 
          onPress={() => setActiveTab('myLetters')}
        >
          <Text style={[
            styles.tabText, 
            { color: theme.colors.onSurface },
            activeTab === 'myLetters' && { color: theme.colors.primary }
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: 'red',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
  },
  tabContent: {
    flex: 1,
  },
});

export default MailboxScreen; 