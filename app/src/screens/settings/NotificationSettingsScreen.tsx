import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Text, Switch, Divider, Button, ActivityIndicator, Banner } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { registerForPushNotificationsAsync, checkNotificationPermissions } from '../../services/notifications';

const NotificationSettingsScreen = () => {
  const { user, profile } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [replyNotifications, setReplyNotifications] = useState(true);
  const [letterNotifications, setLetterNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemPermissionsGranted, setSystemPermissionsGranted] = useState(true);

  useEffect(() => {
    fetchNotificationPreferences();
    checkSystemPermissions();
  }, []);

  const checkSystemPermissions = async () => {
    const permissionStatus = await checkNotificationPermissions();
    setSystemPermissionsGranted(permissionStatus === 'granted');
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
      // If enabling notifications for the first time, request permission
      if (notificationsEnabled) {
        const token = await registerForPushNotificationsAsync();
        if (!token) {
          Alert.alert(
            'Permission Required',
            'Push notifications could not be enabled. Please check your device settings.'
          );
          setNotificationsEnabled(false);
          setSaving(false);
          return;
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
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
          style={styles.banner}
        >
          <Text style={styles.bannerText}>
            Notifications are disabled for this app in your device settings. 
            Please enable them to receive notifications.
          </Text>
        </Banner>
      )}

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.settingTitle}>Enable Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            disabled={!systemPermissionsGranted}
          />
        </View>
        <Text style={styles.settingDescription}>
          Turn on to receive push notifications from the app
        </Text>
      </View>
      
      <Divider style={styles.divider} />
      
      {notificationsEnabled && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to notify me about:</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.settingTitle}>Replies to my letters</Text>
              <Switch
                value={replyNotifications}
                onValueChange={setReplyNotifications}
                disabled={!systemPermissionsGranted}
              />
            </View>
            
            <View style={styles.switchRow}>
              <Text style={styles.settingTitle}>New letters in categories I follow</Text>
              <Switch
                value={letterNotifications}
                onValueChange={setLetterNotifications}
                disabled={!systemPermissionsGranted}
              />
            </View>
          </View>
          
          <Divider style={styles.divider} />
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#6200ee',
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
    color: '#666',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
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