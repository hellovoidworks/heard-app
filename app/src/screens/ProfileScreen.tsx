import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Divider, List } from 'react-native-paper';
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
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
            <Text style={styles.username}>{profile?.username}</Text>
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

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item
          title="Account Settings"
          left={props => <List.Icon {...props} icon="account-cog" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('AccountSettings')}
        />
        <List.Item
          title="Notification Settings"
          left={props => <List.Icon {...props} icon="bell" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('NotificationSettings')}
        />
        <List.Item
          title="Category Preferences"
          left={props => <List.Icon {...props} icon="tag-multiple" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('CategoryPreferencesSettings')}
        />
        <List.Item
          title="Privacy Settings"
          left={props => <List.Icon {...props} icon="shield" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <View style={styles.footer}>
        <Button 
          mode="outlined" 
          onPress={handleSignOut}
          style={styles.signOutButton}
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
    backgroundColor: '#fff',
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