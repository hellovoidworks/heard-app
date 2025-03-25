import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Divider, List, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { removePushToken } from '../services/notifications';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ProfileScreen = () => {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleSignOut = async () => {
    if (user) {
      // Remove all push tokens when signing out
      await removePushToken(user.id);
    }
    await signOut();
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const { error } = await updateProfile({ username });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              theme={{ colors: { text: theme.colors.onSurface } }}
            />
            <View style={styles.buttonRow}>
              <Button 
                mode="outlined" 
                onPress={() => {
                  setEditing(false);
                  setUsername(profile?.username || '');
                }}
                style={styles.button}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleSaveProfile}
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Save
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <Text style={[styles.username, { color: theme.colors.onSurface }]}>
              {profile?.username}
            </Text>
            <Button 
              mode="outlined" 
              onPress={() => setEditing(true)}
              style={styles.editButton}
            >
              Edit Profile
            </Button>
          </View>
        )}
      </View>

      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>Account</List.Subheader>
        <List.Item
          title="Account Settings"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="account-cog" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => navigation.navigate('AccountSettings')}
        />
        <List.Item
          title="Notification Settings"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="bell" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => navigation.navigate('NotificationSettings')}
        />
        <List.Item
          title="Category Preferences"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="tag-multiple" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => navigation.navigate('CategoryPreferencesSettings')}
        />
        <List.Item
          title="Privacy Settings"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="shield" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
        />
      </List.Section>

      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

      <View style={styles.footer}>
        <Button 
          mode="outlined" 
          onPress={handleSignOut}
          style={styles.signOutButton}
          textColor="red"
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
    width: '100%',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  editButton: {
    marginTop: 8,
  },
  editForm: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  divider: {
    marginVertical: 8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  signOutButton: {
    width: '100%',
    borderColor: 'red',
    borderWidth: 1,
  },
});

export default ProfileScreen; 