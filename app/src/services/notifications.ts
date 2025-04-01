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

const DELIVERY_NOTIFICATION_MORNING_ID = 'daily-delivery-morning';
const DELIVERY_NOTIFICATION_EVENING_ID = 'daily-delivery-evening';

export async function scheduleDailyDeliveryNotifications() {
  console.log('[scheduleDailyDeliveryNotifications] Attempting to schedule daily notifications...');
  try {
    // Cancel any existing notifications with the same IDs to avoid duplicates
    await Notifications.cancelScheduledNotificationAsync(DELIVERY_NOTIFICATION_MORNING_ID);
    console.log(`[scheduleDailyDeliveryNotifications] Cancelled existing notification with ID: ${DELIVERY_NOTIFICATION_MORNING_ID}`);
    await Notifications.cancelScheduledNotificationAsync(DELIVERY_NOTIFICATION_EVENING_ID);
    console.log(`[scheduleDailyDeliveryNotifications] Cancelled existing notification with ID: ${DELIVERY_NOTIFICATION_EVENING_ID}`);

    // Define trigger for morning notification (8 AM Local Time) using DailyTriggerInput
    const morningTrigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    };
    await Notifications.scheduleNotificationAsync({
      identifier: DELIVERY_NOTIFICATION_MORNING_ID,
      content: {
        title: "New mail has arrived!",
        body: 'Start reading them now.',
        // data: { type: 'delivery_window' } // Optional data payload
      },
      trigger: morningTrigger,
    });
    console.log(`[scheduleDailyDeliveryNotifications] Scheduled morning notification (${DELIVERY_NOTIFICATION_MORNING_ID}) for 8:00 AM local time.`);

    // Define trigger for evening notification (8 PM Local Time) using DailyTriggerInput
    const eveningTrigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20, // 8 PM
      minute: 0,
    };
    await Notifications.scheduleNotificationAsync({
      identifier: DELIVERY_NOTIFICATION_EVENING_ID,
      content: {
        title: "New mail has arrived!",
        body: 'Start reading them now.',
        // data: { type: 'delivery_window' } // Optional data payload
      },
      trigger: eveningTrigger,
    });
    console.log(`[scheduleDailyDeliveryNotifications] Scheduled evening notification (${DELIVERY_NOTIFICATION_EVENING_ID}) for 8:00 PM local time.`);

  } catch (error) {
    console.error('[scheduleDailyDeliveryNotifications] Failed to schedule daily notifications:', error);
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

    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Current notification permission status:', existingStatus);
    let finalStatus = existingStatus;
    
    // Only request if not already granted
    if (existingStatus !== 'granted') {
      console.log('Requesting notification permissions...');
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('New permission status after request:', finalStatus);
      } catch (permError) {
        console.error('Error requesting notification permissions:', permError);
        // Continue anyway - the user might have manually granted permissions
      }
    } else {
      console.log('Notification permissions already granted');
    }
    
    // Try to get token even if finalStatus isn't granted - the user might have
    // manually enabled permissions in settings
    try {
      // Get push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('Getting Expo push token with projectId:', projectId);
      
      if (!projectId) {
        console.warn('No projectId found in Constants.expoConfig. This is required for push tokens.');
      }
      
      const response = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      token = response.data;
      console.log('Successfully obtained push token:', token);
      
      // If we got here, permissions must be granted regardless of what finalStatus says
      if (finalStatus !== 'granted') {
        console.log('Got token despite finalStatus not being granted. Updating status.');
        // Cast to the correct type to avoid TypeScript errors
        finalStatus = 'granted' as Notifications.PermissionStatus;
      }
    } catch (error) {
      console.error('Error encountered while fetching Expo token:', error);
      return null;
    }
  } else {
    console.log('Push notifications are only configured for iOS in this app');
    return null;
  }

  // Schedule daily notifications
  await scheduleDailyDeliveryNotifications();

  return token;
}

export async function savePushToken(userId: string, token: string) {
  console.log('===== SAVING PUSH TOKEN =====');
  console.log('User ID:', userId);
  console.log('Token:', token);
  
  try {
    // First, check if this token already exists for this user
    console.log('Checking if token already exists in push_tokens table...');
    const { data: existingTokens, error: fetchError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token);

    if (fetchError) {
      console.error('Error checking existing push token:', fetchError);
      console.error('Error details:', JSON.stringify(fetchError));
      return;
    }

    console.log('Existing tokens query result:', existingTokens);
    
    // If token doesn't exist, insert it
    if (!existingTokens || existingTokens.length === 0) {
      console.log('Token does not exist, inserting new token...');
      
      const tokenData = {
        user_id: userId,
        token: token,
        platform: 'expo', // Use 'expo' since we're using Expo's notification service
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Token data to insert:', tokenData);
      
      const { data: insertData, error } = await supabase
        .from('push_tokens')
        .insert(tokenData)
        .select();

      if (error) {
        console.error('Error saving push token:', error);
        console.error('Error details:', JSON.stringify(error));
      } else {
        console.log('Successfully saved push token');
        console.log('Insert result:', insertData);
      }
    } else {
      console.log('Push token already exists for this user');
      console.log('Existing token record:', existingTokens[0]);
    }
    
    // Double-check that the token was saved
    console.log('Verifying token was saved...');
    const { data: verifyTokens, error: verifyError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId);
      
    if (verifyError) {
      console.error('Error verifying push token:', verifyError);
    } else {
      console.log('All tokens for user:', verifyTokens);
    }
    
    console.log('===== PUSH TOKEN SAVE COMPLETE =====');
  } catch (error) {
    console.error('Exception saving push token:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
 * Test function to directly register and save a push token
 */
export async function testSavePushToken(userId: string) {
  console.log('Starting direct push token test for user:', userId);
  
  try {
    // Step 0: Check current permission status
    console.log('Checking current notification permission status...');
    const permissionStatus = await checkNotificationPermissions();
    console.log('Current permission status:', permissionStatus);
    
    // Step 1: Get a push token
    console.log('Requesting push token from device...');
    const token = await registerForPushNotificationsAsync();
    
    if (!token) {
      console.error('Failed to get push token for testing');
      
      // Get more detailed diagnostic information
      let details = '';
      
      // Check if we can get more info about the permission status
      if (permissionStatus !== 'granted') {
        details = `Permission status is ${permissionStatus}. The app needs notification permission to get a push token.`;
      } else {
        details = 'Permission is granted but still unable to obtain token. This could be due to:\n- Device not registered with Apple Push Notification Service\n- Network connectivity issues\n- iOS simulator being used (push tokens don\'t work in simulators)';
      }
      
      return { 
        success: false, 
        error: 'No token obtained from device',
        details: details,
        permissionStatus
      };
    }
    
    console.log('Successfully obtained push token:', token);
    
    // Step 2: Save the token to the database
    console.log('Saving token to database...');
    try {
      await savePushToken(userId, token);
      console.log('Token save operation completed');
    } catch (saveError) {
      console.error('Error during token save operation:', saveError);
      return { 
        success: false, 
        error: 'Failed to save token to database',
        details: saveError instanceof Error ? saveError.message : String(saveError),
        token: token.substring(0, 15) + '...' // Still return partial token for debugging
      };
    }
    
    // Step 3: Verify the token was saved
    console.log('Verifying token was saved...');
    const { data, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token);
    
    if (error) {
      console.error('Error verifying token:', error);
      return { 
        success: false, 
        error: 'Failed to verify token in database',
        details: error.message,
        token: token.substring(0, 15) + '...'
      };
    }
    
    if (!data || data.length === 0) {
      // Check if the token exists for this user but with a different value
      const { data: userTokens, error: userTokensError } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId);
      
      let additionalInfo = '';
      if (!userTokensError && userTokens && userTokens.length > 0) {
        additionalInfo = `User has ${userTokens.length} other token(s) in the database.`;
      }
      
      console.warn('Token not found in database after saving');
      return { 
        success: false, 
        error: 'Token was not found in database after saving',
        details: `The token was not found in the database after the save operation. ${additionalInfo}`,
        token: token.substring(0, 15) + '...'
      };
    }
    
    // Get total count of tokens for this user
    const { data: allUserTokens, error: countError } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId);
    
    const totalTokenCount = countError ? 'unknown' : (allUserTokens?.length || 0);
    
    return { 
      success: true, 
      token: token.substring(0, 15) + '...', 
      tokensInDatabase: data.length,
      totalUserTokens: totalTokenCount,
      message: `Token successfully saved and verified in database. User has ${totalTokenCount} total tokens.`,
      permissionStatus
    };
  } catch (error) {
    console.error('Exception in testSavePushToken:', error);
    // Get the stack trace for better debugging
    const stack = error instanceof Error ? error.stack : 'No stack trace available';
    console.error('Stack trace:', stack);
    
    return { 
      success: false, 
      error: 'Unhandled exception', 
      details: error instanceof Error ? error.message : String(error),
      stack: stack?.substring(0, 500) // Limit stack trace length
    };
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