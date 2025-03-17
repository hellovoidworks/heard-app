import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'ios') {
    // Check if device is physical (not simulator)
    const deviceType = await Device.getDeviceTypeAsync();
    if (deviceType !== Device.DeviceType.PHONE) {
      console.log('Push notifications are not available on simulators');
      return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    try {
      // Get push token
      console.log('Getting Expo push token with projectId:', Constants.expoConfig?.extra?.eas?.projectId);
      const response = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      token = response.data;
      console.log('Successfully obtained push token:', token);
    } catch (error) {
      console.error('Error encountered while fetching Expo token:', error);
      return null;
    }
  } else {
    console.log('Push notifications are only configured for iOS in this app');
    return null;
  }

  return token;
}

export async function savePushToken(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

export async function removePushToken(userId: string) {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ push_token: null })
      .eq('id', userId);

    if (error) {
      console.error('Error removing push token:', error);
    }
  } catch (error) {
    console.error('Error removing push token:', error);
  }
} 