import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { testSavePushToken, sendPushNotification } from '../services/notifications';
import { supabase } from '../services/supabase';
import * as Notifications from 'expo-notifications';

/**
 * A component for testing push notifications
 * This can be added to any screen for development purposes
 */
export const TestPushNotification = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Schedule a local notification for immediate delivery
  const scheduleLocalNotification = async () => {
    try {
      console.log('Scheduling local notification...');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Local Test Notification',
          body: 'This is a local test notification sent at ' + new Date().toLocaleTimeString(),
          data: { test: true },
          sound: true,
        },
        trigger: null, // null means send immediately
      });
      console.log('Local notification scheduled successfully');
      return true;
    } catch (error) {
      console.error('Error scheduling local notification:', error);
      return false;
    }
  };

  const handleTestDbNotification = async () => {
    if (!user) {
      setResult('Error: User not logged in');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Create a test notification in the database based on the actual schema
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: user.id,
          sender_id: user.id, // Self-sent for testing
          type: 'test',
          read: false,
          created_at: new Date().toISOString()
        })
        .select();
      
      if (error) {
        setResult(`Error creating DB notification: ${error.message}`);
        return;
      }
      
      // Try to send a push notification via Expo's sendPushNotification function
      try {
        const pushResult = await sendPushNotification(
          user.id, 
          'Test Push', 
          'This is a test push notification', 
          { test: true }
        );
        
        if (!pushResult.success) {
          console.warn('Edge function push failed, trying local notification');
          // If the Edge Function fails, try a local notification as fallback
          const localSuccess = await scheduleLocalNotification();
          
          if (localSuccess) {
            setResult('Database notification created. Edge function failed but local notification sent successfully!');
          } else {
            setResult(`DB notification created but push failed: ${pushResult.error?.message || 'Unknown error'}. Local notification also failed.`);
          }
        } else {
          setResult('Database notification created and push notification sent successfully!');
        }
      } catch (pushError) {
        console.error('Push notification error:', pushError);
        
        // Try local notification as fallback
        const localSuccess = await scheduleLocalNotification();
        if (localSuccess) {
          setResult('Database notification created. Edge function failed but local notification sent successfully!');
        } else {
          setResult(`DB notification created but push failed: ${pushError instanceof Error ? pushError.message : String(pushError)}`);
        }
      }
    } catch (error) {
      setResult(`Exception: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestDirectPush = async () => {
    if (!user) {
      setResult('Error: User not logged in');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Test saving the push token
      const tokenResult = await testSavePushToken(user.id);
      
      if (tokenResult.success) {
        setResult(`Push token saved successfully! Token: ${tokenResult.token || 'N/A'}`);
      } else {
        setResult(`Failed to save push token: ${tokenResult.error}\nDetails: ${tokenResult.details || 'No details provided'}`);
      }
    } catch (error) {
      setResult(`Exception: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestLocalNotification = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const success = await scheduleLocalNotification();
      if (success) {
        setResult('Local notification sent successfully!');
      } else {
        setResult('Failed to send local notification');
      }
    } catch (error) {
      setResult(`Exception: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Push Notification Testing</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleTestDbNotification}
          disabled={loading || !user}
        >
          <Text style={styles.buttonText}>Test DB Notification</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleTestDirectPush}
          disabled={loading || !user}
        >
          <Text style={styles.buttonText}>Test Direct Push</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleTestLocalNotification}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Local Notification</Text>
        </TouchableOpacity>
      </View>
      
      {loading && <ActivityIndicator style={styles.loader} />}
      
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#161616',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '500',
  },
  loader: {
    marginTop: 12,
  },
  resultContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultText: {
    fontSize: 14,
  },
});
