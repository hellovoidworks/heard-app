import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Alert, Image, TouchableOpacity, Animated } from 'react-native';
import { Adjust, AdjustEvent } from 'react-native-adjust';
import { Button, Text, Title, IconButton, useTheme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  registerForPushNotificationsAsync, 
  savePushToken 
} from '../../services/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPermission'>;

const NotificationPermissionScreen = ({ navigation }: Props) => {
  const { user, checkOnboardingStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bounceAnim = useRef(new Animated.Value(0)).current;
  
  // Setup the bouncing animation
  useEffect(() => {
    // Track the Notifications Appear event
    const adjustEvent = new AdjustEvent('pplvr3');
    Adjust.trackEvent(adjustEvent);
    
    const startBounceAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      ).start();
    };
    
    startBounceAnimation();
    
    return () => {
      bounceAnim.stopAnimation();
    };
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    
    // Track the Enabled Notifications Button tapped event
    const adjustEvent = new AdjustEvent('z0fhf3');
    Adjust.trackEvent(adjustEvent);
    
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
      
      // Note: Daily notifications are automatically scheduled in registerForPushNotificationsAsync
      // when the user enables notifications, so we don't need to call it again here

      // Update user_profiles table with notification preferences as JSON
      console.log('Updating user_profiles with onboarding completion...');
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          onboarding_step: 'completed',
          onboarding_completed: true,
          notification_preferences: {
            enabled: token ? true : false,
            // Use the same keys as the settings screen
            replies: token ? true : false,
            reactions: token ? true : false,
            new_letters: token ? true : false
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
                replies: false,
                reactions: false,
                new_letters: false
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
    
    // Track the Not Now tapped event
    const adjustEvent = new AdjustEvent('udzb4t');
    Adjust.trackEvent(adjustEvent);
    
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
            replies: false,
            reactions: false,
            new_letters: false
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
        <View style={styles.topSection}>
          {/* Title and description */}
          <Title style={[styles.title, { color: theme.colors.onBackground, fontSize: 28, fontWeight: 'bold' }]}>Don't miss anything!</Title>
          
          <Text style={[styles.description, { color: theme.colors.onBackground }]}>
            Keep up when you receive new mail or when someone responds to you
          </Text>
        </View>
        
        {/* Notification image */}
        <View style={styles.imageContainer}>
          <Image 
            source={require('../../assets/notification-request.png')} 
            style={styles.notificationImage} 
            resizeMode="contain"
          />
          
          {/* Bouncing hand emoji */}
          <View style={styles.handContainer}>
            <Animated.Text 
              style={[styles.handEmoji, {
                transform: [{
                  translateY: bounceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15]
                  })
                }]
              }]}
            >
              👆
            </Animated.Text>
          </View>
        </View>
        
        {/* Buttons at the bottom */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
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
          
          <TouchableOpacity
            onPress={handleSkip}
            disabled={loading}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    flex: 1,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 28,
  },
  description: {
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 16,
    lineHeight: 24,
  },
  topSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingTop: 0,
    marginTop: -20,
  },
  notificationImage: {
    width: 270,
    height: 270,
  },
  handContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    marginTop: -30,
  },
  handEmoji: {
    fontSize: 36,
    marginLeft: 135, // Offset to the right from center
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 6,
    marginBottom: 16,
    borderRadius: 28,
  },
  skipButton: {
    padding: 10,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default NotificationPermissionScreen; 