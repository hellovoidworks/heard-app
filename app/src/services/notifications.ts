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

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function checkNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (Platform.OS !== 'ios') {
    return 'granted'; // Only checking iOS for now
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as NotificationPermissionStatus;
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return 'denied';
  }
}

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
    // First, check if this token already exists for this user
    const { data: existingTokens, error: fetchError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token);

    if (fetchError) {
      console.error('Error checking existing push token:', fetchError);
      return;
    }

    // If token doesn't exist, insert it
    if (!existingTokens || existingTokens.length === 0) {
      const { error } = await supabase
        .from('push_tokens')
        .insert({
          user_id: userId,
          token: token,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving push token:', error);
      } else {
        console.log('Successfully saved push token');
      }
    } else {
      console.log('Push token already exists for this user');
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

export async function removePushToken(userId: string, token?: string) {
  try {
    let query = supabase
      .from('push_tokens')
      .delete();
    
    // If token is provided, remove just that specific token
    if (token) {
      query = query
        .eq('user_id', userId)
        .eq('token', token);
    } else {
      // Otherwise, remove all tokens for this user
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error removing push token(s):', error);
    } else {
      console.log('Successfully removed push token(s)');
    }
  } catch (error) {
    console.error('Error removing push token(s):', error);
  }
}

/**
 * Send a push notification to a specific user using Supabase Edge Function
 * @param userId The ID of the user to send the notification to
 * @param title The notification title
 * @param body The notification body text
 * @param data Optional additional data to include with the notification
 */
export async function sendPushNotification(userId: string, title: string, body: string, data?: Record<string, any>) {
  try {
    console.log('Sending push notification to user:', userId);
    
    // Get the current session to include the auth token
    const { data: sessionData } = await supabase.auth.getSession();
    
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: { userId, title, body, data },
      headers: sessionData?.session ? {
        Authorization: `Bearer ${sessionData.session.access_token}`
      } : undefined
    });

    if (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error };
    }

    console.log('Push notification sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Exception sending push notification:', error);
    return { success: false, error };
  }
}