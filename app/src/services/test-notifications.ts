import { supabase } from './supabase';
import { sendPushNotification } from './notifications';
import * as Notifications from 'expo-notifications';

/**
 * Creates a test notification in the database
 * This will trigger the database function that queues push notifications
 * @param userId The user ID to send the notification to
 */
export async function createTestNotification(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: userId,
        sender_id: userId, // Using same ID for test
        type: 'test',
        read: false,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error creating test notification:', error);
      return { success: false, error };
    }

    console.log('Test notification created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception creating test notification:', error);
    return { success: false, error };
  }
}

/**
 * Sends a test push notification directly using the Edge Function
 * This bypasses the database and sends directly to the device
 * @param userId The user ID to send the notification to
 */
export async function sendTestPushNotification(userId: string) {
  try {
    // First try using the Edge Function
    const result = await sendPushNotification(
      userId,
      'Test Notification',
      'This is a test push notification from Heard App',
      { test: true, timestamp: new Date().toISOString() }
    );

    // Then also send a local notification for development testing
    await scheduleLocalNotification();

    console.log('Test push notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending test push notification:', error);
    
    // Try local notification as fallback
    try {
      await scheduleLocalNotification();
      return { success: true, result: { local: true } };
    } catch (localError) {
      console.error('Local notification also failed:', localError);
      return { success: false, error };
    }
  }
}

/**
 * Schedule a local notification for immediate delivery
 * This is useful for development testing when the Edge Function isn't available
 */
async function scheduleLocalNotification() {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Local Notification",
        body: "This is a direct test from the Heard App",
        data: { local: true, timestamp: new Date().toISOString() },
        sound: true,
      },
      trigger: null, // Deliver immediately
    });
    
    console.log('Local notification scheduled with ID:', id);
    return id;
  } catch (error) {
    console.error('Error scheduling local notification:', error);
    throw error;
  }
}
