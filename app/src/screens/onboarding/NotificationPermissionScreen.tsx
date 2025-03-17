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
      if (!user) {
        throw new Error('User not found');
      }

      console.log('Requesting notification permissions...');
      // Request notification permissions
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        console.log('Push token obtained:', token);
        // Save the push token
        await savePushToken(user.id, token);
        console.log('Push token saved successfully');
      } else {
        console.log('No push token obtained - user denied permissions or error occurred');
      }
      
      // Update user_profiles table with notification preferences as JSON
      console.log('Updating user_profiles with onboarding completion...');
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          onboarding_step: 'completed',
          onboarding_completed: true,
          notification_preferences: {
            enabled: token ? true : false,
            // Future granular settings can be added here
            new_replies: token ? true : false,
            new_reactions: token ? true : false,
            system_announcements: token ? true : false
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (profileError) {
        console.error('Error updating user profile:', profileError);
        throw profileError;
      }
      
      console.log('User profile updated with onboarding completion');
      
      // Complete onboarding
      completeOnboarding();
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      Alert.alert('Error', error.message || 'Failed to enable notifications');
      
      if (user) {
        // Still mark onboarding as complete even if there was an error
        try {
          await supabase
            .from('user_profiles')
            .update({
              onboarding_step: 'completed',
              onboarding_completed: true,
              notification_preferences: {
                enabled: false,
                new_replies: false,
                new_reactions: false,
                system_announcements: false
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
          
          console.log('User profile updated with onboarding completion (after error)');
        } catch (updateError) {
          console.error('Error updating user profile after notification error:', updateError);
        }
      }
      
      completeOnboarding();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    
    try {
      if (!user) {
        throw new Error('User not found');
      }

      console.log('Skipping notifications, updating user_profiles...');
      // Update user_profiles table with notification preferences as JSON
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          onboarding_step: 'completed',
          onboarding_completed: true,
          notification_preferences: {
            enabled: false,
            new_replies: false,
            new_reactions: false,
            system_announcements: false
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (profileError) {
        console.error('Error updating user profile:', profileError);
        throw profileError;
      }
      
      console.log('User profile updated with onboarding completion (skipped notifications)');
      
      // Complete onboarding
      completeOnboarding();
    } catch (error: any) {
      console.error('Error skipping notifications:', error);
      Alert.alert('Error', error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const completeOnboarding = () => {
    console.log('Completing onboarding, resetting navigation to Main...');
    // Navigate to the main app
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' as any }],
      });
      console.log('Navigation reset successful');
    } catch (error) {
      console.error('Error resetting navigation:', error);
      
      // Fallback navigation if reset fails
      try {
        // @ts-ignore - This is a workaround for navigation issues
        navigation.navigate('Root', { screen: 'Main' });
        console.log('Fallback navigation successful');
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
        Alert.alert(
          'Navigation Error',
          'Could not navigate to the main app. Please restart the app.'
        );
      }
    }
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