import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import CorrespondenceTab from './mailbox/CorrespondenceTab';
import MyLettersTab from './mailbox/MyLettersTab';

const MailboxScreen = () => {
  const [activeTab, setActiveTab] = useState('correspondence');
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
          <Text style={[
            styles.tabText, 
            { color: theme.colors.onSurface },
            activeTab === 'correspondence' && { color: theme.colors.primary }
          ]}>
            My Responses
          </Text>
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
        {activeTab === 'correspondence' ? <CorrespondenceTab /> : <MyLettersTab />}
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
  tabText: {
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
});

export default MailboxScreen; 