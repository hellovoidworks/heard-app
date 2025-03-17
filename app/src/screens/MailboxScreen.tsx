import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import CorrespondenceTab from './mailbox/CorrespondenceTab';
import MyLettersTab from './mailbox/MyLettersTab';

const MailboxScreen = () => {
  const [activeTab, setActiveTab] = useState('correspondence');

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'correspondence' && styles.activeTab]} 
          onPress={() => setActiveTab('correspondence')}
        >
          <Text style={[styles.tabText, activeTab === 'correspondence' && styles.activeTabText]}>
            Correspondence
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'myLetters' && styles.activeTab]} 
          onPress={() => setActiveTab('myLetters')}
        >
          <Text style={[styles.tabText, activeTab === 'myLetters' && styles.activeTabText]}>
            My Letters
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabContent}>
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
    backgroundColor: 'white',
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
    borderBottomColor: '#6200ee',
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6200ee',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
});

export default MailboxScreen; 