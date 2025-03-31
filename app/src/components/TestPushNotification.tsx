import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { createTestNotification, sendTestPushNotification } from '../services/test-notifications';

/**
 * A component for testing push notifications
 * This can be added to any screen for development purposes
 */
export const TestPushNotification = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleTestDbNotification = async () => {
    if (!user) {
      setResult('Error: User not logged in');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // First create the DB notification
      const dbResponse = await createTestNotification(user.id);
      
      if (!dbResponse.success) {
        setResult(`Error creating DB notification: ${JSON.stringify(dbResponse.error)}`);
        return;
      }
      
      // Then send a direct push notification
      const pushResponse = await sendTestPushNotification(user.id);
      
      setResult(pushResponse.success 
        ? 'Database notification created and push notification sent successfully!' 
        : `DB notification created but push failed: ${JSON.stringify(pushResponse.error)}`);
    } catch (error) {
      setResult(`Exception: ${error}`);
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
      const response = await sendTestPushNotification(user.id);
      setResult(response.success 
        ? 'Push notification sent successfully!' 
        : `Error: ${JSON.stringify(response.error)}`);
    } catch (error) {
      setResult(`Exception: ${error}`);
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
