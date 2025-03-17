import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { registerForPushNotificationsAsync, savePushToken } from '../services/notifications';
import { Ionicons } from '@expo/vector-icons';
import linking from '../utils/linking';
import { supabase } from '../services/supabase';

// Import screens from the index file
import {
  LoginScreen,
  HomeScreen,
  ProfileScreen,
  NotificationsScreen,
  WriteLetterScreen,
  LetterDetailScreen
} from '../screens';

// Import onboarding screens
import {
  AgeVerificationScreen,
  CategoryPreferencesScreen,
  NotificationPermissionScreen
} from '../screens/onboarding';

// Import navigation types
import { RootStackParamList, AuthStackParamList, MainTabParamList, OnboardingStackParamList } from './types';

// Create navigators
const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Auth navigator
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

// Onboarding navigator
const OnboardingNavigator = () => {
  console.log('Rendering OnboardingNavigator');
  return (
    <OnboardingStack.Navigator 
      screenOptions={{ headerShown: false }}
      screenListeners={{
        state: (e) => {
          console.log('Onboarding navigation state changed:', e.data);
        },
      }}
    >
      <OnboardingStack.Screen 
        name="AgeVerification" 
        component={AgeVerificationScreen} 
        listeners={{
          focus: () => console.log('AgeVerification screen focused'),
          blur: () => console.log('AgeVerification screen blurred'),
        }}
      />
      <OnboardingStack.Screen 
        name="CategoryPreferences" 
        component={CategoryPreferencesScreen} 
        listeners={{
          focus: () => console.log('CategoryPreferences screen focused'),
          blur: () => console.log('CategoryPreferences screen blurred'),
        }}
      />
      <OnboardingStack.Screen 
        name="NotificationPermission" 
        component={NotificationPermissionScreen} 
        listeners={{
          focus: () => console.log('NotificationPermission screen focused'),
          blur: () => console.log('NotificationPermission screen blurred'),
        }}
      />
    </OnboardingStack.Navigator>
  );
};

// Main tab navigator
const MainNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: keyof typeof Ionicons.glyphMap = 'home';

        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Write') {
          iconName = focused ? 'create' : 'create-outline';
        } else if (route.name === 'Notifications') {
          iconName = focused ? 'notifications' : 'notifications-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#6200ee',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Write" component={WriteLetterScreen} />
    <Tab.Screen name="Notifications" component={NotificationsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Root navigator
const AppNavigator = () => {
  const { user, loading, isOnboardingComplete } = useAuth();

  useEffect(() => {
    if (user && isOnboardingComplete) {
      // Register for push notifications when user is logged in and has completed onboarding
      const registerForNotifications = async () => {
        try {
          // Get user profile to check notification preferences
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('notification_preferences')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.error('Error fetching user profile:', profileError);
            return;
          }
          
          // Check if notifications are enabled in the notification_preferences JSON
          if (profileData?.notification_preferences?.enabled === true) {
            console.log('Notifications are enabled, registering for push notifications');
            const token = await registerForPushNotificationsAsync();
            if (token) {
              console.log('Push token obtained, saving to user profile');
              await savePushToken(user.id, token);
            } else {
              console.log('No push token obtained');
            }
          } else {
            console.log('Notifications are not enabled for this user');
          }
        } catch (error) {
          console.error('Error registering for notifications:', error);
        }
      };

      registerForNotifications();
    }
  }, [user, isOnboardingComplete]);

  if (loading || (user && isOnboardingComplete === null)) {
    // You could return a loading screen here
    return null;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          isOnboardingComplete === false ? (
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainNavigator} />
              <Stack.Screen name="LetterDetail" component={LetterDetailScreen} options={{ headerShown: true, title: 'Letter' }} />
              <Stack.Screen name="WriteLetter" component={WriteLetterScreen} options={{ headerShown: true, title: 'Write Letter' }} />
            </>
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 