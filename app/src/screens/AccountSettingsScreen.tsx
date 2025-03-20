import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Divider, List, Button } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

const AccountSettingsScreen = () => {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <Divider style={styles.divider} />
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Account ID</Text>
          <Text style={styles.infoValue}>{user?.id}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Account Created</Text>
          <Text style={styles.infoValue}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <Divider style={styles.divider} />
        
        <List.Item
          title="Change Password"
          left={props => <List.Icon {...props} icon="lock" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // Handle password change - could navigate to a password change screen
            // or use the Supabase password reset flow
          }}
        />
        
        <List.Item
          title="Two-Factor Authentication"
          description="Not enabled"
          left={props => <List.Icon {...props} icon="shield-account" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // Handle 2FA setup
          }}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <Divider style={styles.divider} />
        
        <List.Item
          title="Export Your Data"
          left={props => <List.Icon {...props} icon="download" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // Handle data export
          }}
        />
        
        <List.Item
          title="Delete Account"
          titleStyle={{ color: 'red' }}
          left={props => <List.Icon {...props} icon="delete" color="red" />}
          onPress={() => {
            // Handle account deletion with proper confirmation
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
  },
});

export default AccountSettingsScreen; 