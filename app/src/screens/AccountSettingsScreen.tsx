import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Divider, List, Button, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

const AccountSettingsScreen = () => {
  const { user } = useAuth();
  const theme = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Account Information</Text>
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        
        <View style={[styles.infoItem, { borderBottomColor: theme.colors.outline }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>Email</Text>
          <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>{user?.email}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: theme.colors.outline }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>Account ID</Text>
          <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>{user?.id}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: theme.colors.outline }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>Account Created</Text>
          <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Security</Text>
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        
        <List.Item
          title="Change Password"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="lock" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => {
            // Handle password change - could navigate to a password change screen
            // or use the Supabase password reset flow
          }}
        />
        
        <List.Item
          title="Two-Factor Authentication"
          description="Not enabled"
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
          left={props => <List.Icon {...props} icon="shield-account" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => {
            // Handle 2FA setup
          }}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Data</Text>
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        
        <List.Item
          title="Export Your Data"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="download" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
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
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
  },
});

export default AccountSettingsScreen; 