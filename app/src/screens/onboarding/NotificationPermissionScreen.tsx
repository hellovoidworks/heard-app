import React, { useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { Button, Text, Title, IconButton, useTheme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { registerForPushNotificationsAsync, savePushToken } from '../../services/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPermission'>;

const NotificationPermissionScreen = ({ navigation }: Props) => {
  const { user, checkOnboardingStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleEnableNotifications = async () => {
    setLoading(true);
    
    try {
      if (!user) {
        throw new Error('User not found');
      }

      console.log('Requesting notification permissions...');
      // Request notification permissions
      let token = null;
      try {
        token = await registerForPushNotificationsAsync();
        if (token) {
          console.log('Push token obtained:', token);
          // Save the push token
          await savePushToken(user.id, token);
          console.log('Push token saved successfully');
        } else {
          console.log('No push token obtained - user denied permissions or error occurred');
        }
      } catch (notificationError) {
        console.error('Error in notification registration:', notificationError);
        // Continue with onboarding even if notifications fail
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
      Alert.alert('Error', 'There was a problem enabling notifications. You can enable them later in settings.');
      
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
    console.log('Completing onboarding...');
    try {
      // Instead of trying to navigate directly, we'll refresh the onboarding status
      // This will cause the AppNavigator to re-render with isOnboardingComplete=true
      // which will automatically show the Main screen
      console.log('Checking onboarding status to trigger navigation change');
      checkOnboardingStatus()
        .then(() => {
          console.log('Onboarding status checked successfully');
        })
        .catch((error) => {
          console.error('Error checking onboarding status:', error);
          Alert.alert(
            'Error',
            'Could not complete onboarding. Please restart the app.'
          );
        });
    } catch (error) {
      console.error('Onboarding completion failed:', error);
      Alert.alert(
        'Error',
        'Could not complete onboarding. Please restart the app.'
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={handleGoBack}
          iconColor={theme.colors.onBackground}
        />
        <View style={{ width: 40 }} />
      </View>
      
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Ionicons name="notifications" size={100} color={theme.colors.primary} />
        </View>
        
        <Title style={[styles.title, { color: theme.colors.onBackground, fontSize: 28, fontWeight: 'bold' }]}>Stay Updated</Title>
        
        <Text style={[styles.description, { color: theme.colors.onBackground }]}>
          Enable notifications to receive updates when someone responds to your letters or sends you a message.
        </Text>
        
        <Button
          mode="contained"
          onPress={handleEnableNotifications}
          style={styles.primaryButton}
          loading={loading}
          disabled={loading}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          labelStyle={{ fontSize: 18, fontWeight: 'bold' }}
        >
          Enable Notifications
        </Button>
        
        <Button
          mode="text"
          onPress={handleSkip}
          style={styles.skipButton}
          disabled={loading}
          textColor={theme.colors.primary}
          labelStyle={{ fontSize: 16 }}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    textAlign: 'center',
    marginBottom: 20,
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
    borderRadius: 28,
  },
  skipButton: {
    marginTop: 8,
  },
});

export default NotificationPermissionScreen; 