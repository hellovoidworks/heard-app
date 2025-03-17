import React, { useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { Button, Text, Title, IconButton } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { registerForPushNotificationsAsync, savePushToken } from '../../services/notifications';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPermission'>;

const NotificationPermissionScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleEnableNotifications = async () => {
    setLoading(true);
    
    try {
      // Request notification permissions
      const token = await registerForPushNotificationsAsync();
      
      if (token && user) {
        // Save the push token
        await savePushToken(user.id, token);
        
        // Update user metadata
        await supabase.auth.updateUser({
          data: { 
            onboarding_completed: true,
            notifications_enabled: true
          }
        });
      } else {
        // User denied permissions or there was an error
        await supabase.auth.updateUser({
          data: { 
            onboarding_completed: true,
            notifications_enabled: false
          }
        });
      }
      
      // Complete onboarding
      completeOnboarding();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to enable notifications');
      
      // Still mark onboarding as complete even if there was an error
      await supabase.auth.updateUser({
        data: { 
          onboarding_completed: true,
          notifications_enabled: false
        }
      });
      
      completeOnboarding();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    
    try {
      // Update user metadata
      await supabase.auth.updateUser({
        data: { 
          onboarding_completed: true,
          notifications_enabled: false
        }
      });
      
      // Complete onboarding
      completeOnboarding();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const completeOnboarding = () => {
    // Navigate to the main app
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' as any }],
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={handleGoBack}
        />
        <View style={{ width: 40 }} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={100} color="#6200ee" />
        </View>
        
        <Title style={styles.title}>Stay Updated</Title>
        
        <Text style={styles.description}>
          Enable notifications to receive updates when someone responds to your letters or sends you a message.
        </Text>
        
        <Button
          mode="contained"
          onPress={handleEnableNotifications}
          style={styles.primaryButton}
          loading={loading}
          disabled={loading}
        >
          Enable Notifications
        </Button>
        
        <Button
          mode="text"
          onPress={handleSkip}
          style={styles.skipButton}
          disabled={loading}
        >
          Not Now
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f0e6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 40,
    fontSize: 16,
    lineHeight: 24,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 6,
    marginBottom: 16,
  },
  skipButton: {
    marginTop: 8,
  },
});

export default NotificationPermissionScreen; 