import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Text, Switch, Divider, Button, ActivityIndicator, Banner, useTheme } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { registerForPushNotificationsAsync, checkNotificationPermissions, savePushToken, testSavePushToken } from '../../services/notifications';

const NotificationSettingsScreen = () => {
  const { user, profile } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [replyNotifications, setReplyNotifications] = useState(true);
  const [letterNotifications, setLetterNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemPermissionsGranted, setSystemPermissionsGranted] = useState(true);
  const [testingToken, setTestingToken] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    fetchNotificationPreferences();
    checkSystemPermissions();
    requestInitialPermissions();
  }, []);

  const checkSystemPermissions = async () => {
    const permissionStatus = await checkNotificationPermissions();
    setSystemPermissionsGranted(permissionStatus === 'granted');
  };

  const requestInitialPermissions = async () => {
    console.log('Requesting initial notification permissions');
    try {
      // Request permissions without saving to profile yet
      // This ensures the app shows up in iOS settings
      const token = await registerForPushNotificationsAsync();
      if (token) {
        console.log('Successfully obtained push token on screen open:', token);
        // We don't save the token here - that happens when the user enables notifications
      } else {
        console.log('No push token obtained on screen open');
      }
      // Refresh permission status after request
      checkSystemPermissions();
    } catch (error) {
      console.error('Error requesting initial notification permissions:', error);
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    }
  };

  const fetchNotificationPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching notification preferences:', error);
        return;
      }
      
      if (data && data.notification_preferences) {
        const prefs = data.notification_preferences;
        setNotificationsEnabled(prefs.enabled || false);
        setReplyNotifications(prefs.replies !== false); // Default to true if not set
        setLetterNotifications(prefs.new_letters !== false); // Default to true if not set
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationPreferences = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // If enabling notifications, ensure we have permission and a token
      if (notificationsEnabled) {
        // First check if we already have permission
        const permissionStatus = await checkNotificationPermissions();
        console.log('Current notification permission status:', permissionStatus);
        
        // Get token (this will use existing permission if already granted)
        const token = await registerForPushNotificationsAsync();
        
        if (!token) {
          console.log('Failed to get push token despite permissions check');
          
          // Only show alert if permissions are not granted
          if (permissionStatus !== 'granted') {
            Alert.alert(
              'Permission Required',
              'Push notifications could not be enabled. Please check your device settings.'
            );
            setNotificationsEnabled(false);
            setSaving(false);
            return;
          } else {
            // This is an unexpected error - permissions are granted but no token
            console.error('Unexpected: Permission is granted but no token obtained');
            // Continue anyway to save preferences
          }
        } else {
          // We have a valid token, save it
          try {
            console.log('Saving push token to database:', token);
            await savePushToken(user.id, token);
            console.log('Successfully saved push token to database');
          } catch (tokenError) {
            console.error('Error saving push token:', tokenError);
            // Continue even if token saving fails - we'll try again later
          }
        }
        
        // Recheck the permission status after registration
        checkSystemPermissions();
      }
      
      const preferences = {
        enabled: notificationsEnabled,
        replies: replyNotifications,
        new_letters: letterNotifications
      };
      
      const { error } = await supabase
        .from('user_profiles')
        .update({
          notification_preferences: preferences
        })
        .eq('id', user.id);
      
      if (error) {
        console.error('Error updating notification preferences:', error);
        Alert.alert('Error', 'Failed to save notification preferences');
        return;
      }
      
      Alert.alert('Success', 'Notification preferences updated successfully');
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!systemPermissionsGranted && (
        <Banner
          visible={true}
          actions={[
            {
              label: 'Open Settings',
              onPress: openSettings,
            }
          ]}
          icon="alert"
          style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]}
        >
          <Text style={[styles.bannerText, { color: theme.colors.onErrorContainer }]}>
            Notifications are disabled for this app in your device settings. 
            Please enable them to receive notifications.
          </Text>
        </Banner>
      )}

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>Enable Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            disabled={!systemPermissionsGranted}
            color={theme.colors.primary}
          />
        </View>
        <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
          Turn on to receive push notifications from the app
        </Text>
      </View>
      
      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
      
      {notificationsEnabled && (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>What to notify me about:</Text>
            
            <View style={styles.switchRow}>
              <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>Replies to my letters</Text>
              <Switch
                value={replyNotifications}
                onValueChange={setReplyNotifications}
                disabled={!systemPermissionsGranted}
                color={theme.colors.primary}
              />
            </View>
            
            <View style={styles.switchRow}>
              <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>New letters in categories I follow</Text>
              <Switch
                value={letterNotifications}
                onValueChange={setLetterNotifications}
                disabled={!systemPermissionsGranted}
                color={theme.colors.primary}
              />
            </View>
          </View>
          
          <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        </>
      )}
      
      <View style={styles.buttonContainer}>
        {!systemPermissionsGranted ? (
          <Button
            mode="contained"
            onPress={openSettings}
            style={styles.saveButton}
          >
            Open iOS Settings
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={saveNotificationPreferences}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
          >
            Save Preferences
          </Button>
        )}
      </View>
      
      {/* Test Button for Developers */}
      <View style={styles.devSection}>
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        <Text style={[styles.devTitle, { color: theme.colors.error }]}>Developer Testing</Text>
        <Button
          mode="outlined"
          onPress={async () => {
            if (!user) return;
            
            // Set a timeout to prevent infinite loading
            const timeoutId = setTimeout(() => {
              console.warn('Test token save operation timed out after 15 seconds');
              Alert.alert(
                'Operation Timed Out',
                'The token save operation took too long. Check console logs for details.'
              );
              setTestingToken(false);
            }, 15000); // 15 second timeout
            
            setTestingToken(true);
            console.log('Starting test token save operation...');
            
            try {
              // Log each step of the process
              console.log('Step 1: Calling testSavePushToken for user:', user.id);
              const result = await testSavePushToken(user.id);
              console.log('Step 2: Received result from testSavePushToken:', JSON.stringify(result, null, 2));
              
              // Clear the timeout since we got a response
              clearTimeout(timeoutId);
              
              if (result.success) {
                console.log('Step 3: Test successful');
                Alert.alert(
                  'Test Successful', 
                  `Token saved successfully! ${result.message || ''}

Token: ${result.token || 'N/A'}
Tokens in DB: ${result.tokensInDatabase || 0}`
                );
              } else {
                console.warn('Step 3: Test failed with error:', result.error);
                Alert.alert(
                  'Test Failed', 
                  `Error: ${result.error}

Details: ${result.details || 'No details provided'}`
                );
              }
            } catch (error) {
              // Clear the timeout since we got a response (even if it's an error)
              clearTimeout(timeoutId);
              
              console.error('Unhandled exception in test token save:', error);
              
              // Try to extract more information from the error
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
              
              console.error('Error details:\nMessage:', errorMessage, '\nStack:', errorStack);
              
              Alert.alert(
                'Test Error', 
                `An unexpected error occurred: ${errorMessage}\n\nCheck the console logs for more details.`
              );
            } finally {
              console.log('Test token save operation completed');
              setTestingToken(false);
            }
          }}
          style={styles.testButton}
          disabled={testingToken}
          loading={testingToken}
        >
          Test Direct Token Save
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  devSection: {
    marginTop: 40,
    paddingHorizontal: 16,
  },
  devTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  testButton: {
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 14,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingTitle: {
    fontSize: 16,
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    height: 1,
  },
  buttonContainer: {
    padding: 16,
    marginTop: 16,
  },
  saveButton: {
    paddingVertical: 8,
  },
});

export default NotificationSettingsScreen; 