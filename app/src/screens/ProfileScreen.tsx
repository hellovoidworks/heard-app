import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput as RNTextInput } from 'react-native';
import { Text, Button, Divider, List, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { removePushToken } from '../services/notifications';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import UsernameInput from '../components/UsernameInput';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ProfileScreen = () => {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            if (user) {
              // Remove all push tokens when signing out
              await removePushToken(user.id);
            }
            await signOut();
          },
        },
      ]
    );
  };



  const handleSaveProfile = async () => {
    // Reset any previous errors
    setUsernameError(null);
    
    // Basic validation
    if (!username.trim()) {
      setUsernameError('Username cannot be empty');
      return;
    }
    
    if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    // Only check for uniqueness if username has changed
    if (profile && username !== profile.username) {
      setLoading(true);
      try {
        // Check if username is unique using our database function
        const { data, error } = await supabase.rpc('is_username_available', {
          check_username: username,
          current_user_id: user?.id
        });
        
        if (error) {
          console.error('Error checking username availability:', error);
          setUsernameError('Error checking username availability');
          setLoading(false);
          return;
        }
        
        if (data === false) {
          setUsernameError('Username already taken. Please choose a different username.');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Exception checking username availability:', error);
        setUsernameError('Error checking username availability');
        setLoading(false);
        return;
      }
    }

    // If we get here, the username is valid and unique (or unchanged)
    try {
      const { error } = await updateProfile({ username });
      if (error) {
        if (error.message.includes('already taken')) {
          setUsernameError('Username already taken. Please choose a different username.');
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        setEditing(false);
        Alert.alert('Success', 'Your username has been updated successfully');
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
            <UsernameInput
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setUsernameError(null); // Clear error when user types
              }}
              label="Username"
              error={usernameError || undefined}
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
              Change Username
            </Button>
          </View>
        )}
      </View>

      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>Account</List.Subheader>
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
          title="Delete My Account"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="account-remove" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </List.Section>

      <List.Section>
        <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>Terms & Privacy</List.Subheader>
        <List.Item
          title="Terms"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="file-document" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => navigation.navigate('WebView', { 
            url: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', 
            title: 'Terms' 
          })}
        />
        <List.Item
          title="Privacy Policy"
          titleStyle={{ color: theme.colors.onSurface }}
          left={props => <List.Icon {...props} icon="shield-lock" color={theme.colors.primary} />}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
          onPress={() => navigation.navigate('WebView', { 
            url: 'https://www.apple.com/legal/privacy/en-ww/', 
            title: 'Privacy Policy' 
          })}
        />
      </List.Section>

      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

      <View style={styles.footer}>
        <Button 
          mode="outlined" 
          onPress={handleSignOut}
          style={styles.signOutButton}
          textColor="white"
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
    borderColor: 'white',
    borderWidth: 1,
  },
  deleteButton: {
    width: '100%',
    borderColor: 'red',
    borderWidth: 1,
    marginTop: 8,
  },
  dangerZoneText: {
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 4,
  },
});

export default ProfileScreen; 