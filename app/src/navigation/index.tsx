import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { registerForPushNotificationsAsync, savePushToken } from '../services/notifications';
import { Ionicons } from '@expo/vector-icons';
import linking from '../utils/linking';
import { supabase } from '../services/supabase';
import { CommonActions } from '@react-navigation/native';
import { View, TouchableOpacity, Text } from 'react-native';

// Import screens from the index file
import {
  LoginScreen,
  HomeScreen,
  ProfileScreen,
  NotificationsScreen,
  WriteLetterScreen,
  LetterDetailScreen,
  ThreadDetailScreen,
  MailboxScreen,
  NotificationSettingsScreen,
  CategoryPreferencesSettingsScreen,
  AccountSettingsScreen
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
  <AuthStack.Navigator 
    screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: '#121212' }
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

// Onboarding navigator
const OnboardingNavigator = () => {
  console.log('Rendering OnboardingNavigator');
  return (
    <OnboardingStack.Navigator 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#121212' }
      }}
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
const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#FFFFFF',
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 60,
          backgroundColor: '#121212',
          borderTopColor: '#2C2C2C',
        },
        tabBarActiveTintColor: '#BB86FC',
        tabBarInactiveTintColor: '#666666',
      }}
      tabBar={props => (
        <View style={{
          flexDirection: 'row',
          height: 60,
          backgroundColor: '#121212',
          borderTopColor: '#2C2C2C',
          borderTopWidth: 1,
          alignItems: 'center',
          justifyContent: 'space-around',
        }}>
          {/* Home Tab */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => props.navigation.navigate('Home')}
          >
            <Text style={{
              color: props.state.index === 0 ? '#BB86FC' : '#666666',
              fontSize: 16,
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}>
              HOME
            </Text>
          </TouchableOpacity>

          {/* Write Button (Center) - Opens Write Screen as Modal */}
          <TouchableOpacity
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#3F51B5',
              alignItems: 'center',
              justifyContent: 'center',
              bottom: 5,
            }}
            onPress={() => props.navigation.getParent()?.navigate('WriteLetter')}
          >
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>+</Text>
          </TouchableOpacity>

          {/* Mailbox Tab */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => props.navigation.navigate('Mailbox')}
          >
            <Text style={{
              color: props.state.index === 1 ? '#BB86FC' : '#666666',
              fontSize: 16,
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}>
              MAILBOX
            </Text>
          </TouchableOpacity>
        </View>
      )}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={({ navigation }) => ({
          headerLeft: () => (
            <Ionicons 
              name="notifications-outline" 
              size={24} 
              color="#BB86FC" 
              style={{ marginLeft: 15 }}
              onPress={() => {
                navigation.getParent()?.navigate('Notifications');
              }}
            />
          ),
          headerRight: () => (
            <Ionicons 
              name="person-circle-outline" 
              size={24} 
              color="#BB86FC" 
              style={{ marginRight: 15 }}
              onPress={() => {
                navigation.getParent()?.navigate('Profile');
              }}
            />
          ),
        })}
      />
      <Tab.Screen name="Mailbox" component={MailboxScreen} />
    </Tab.Navigator>
  );
};

// App root navigator
const AppNavigator = () => {
  const { user, loading, isOnboardingComplete } = useAuth();

  console.log('AppNavigator rendering with state:', { 
    hasUser: !!user,
    loading,
    isOnboardingComplete: isOnboardingComplete
  });

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
    console.log('Navigation is in loading state, returning null view');
    return null;
  }

  console.log('Rendering NavigationContainer with current auth state:', {
    hasUser: !!user,
    isOnboardingComplete
  });

  return (
    <NavigationContainer theme={DarkTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#121212' },
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFFFFF'
      }}>
        {user ? (
          isOnboardingComplete === false ? (
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainNavigator} />
              <Stack.Screen 
                name="LetterDetail" 
                component={LetterDetailScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Letter',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="ThreadDetail" 
                component={ThreadDetailScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Conversation',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="WriteLetter" 
                component={WriteLetterScreen} 
                options={({ navigation }) => ({ 
                  headerShown: true, 
                  title: 'Write Letter',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF',
                  presentation: 'modal',
                  headerLeft: () => (
                    <Ionicons 
                      name="close-outline" 
                      size={28} 
                      color="#FFFFFF" 
                      style={{ marginLeft: 5 }}
                      onPress={() => navigation.goBack()}
                    />
                  ),
                })} 
              />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Profile',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="Notifications" 
                component={NotificationsScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Notifications',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="NotificationSettings" 
                component={NotificationSettingsScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Notification Settings',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="CategoryPreferencesSettings" 
                component={CategoryPreferencesSettingsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="AccountSettings" 
                component={AccountSettingsScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Account Settings',
                  headerStyle: { backgroundColor: '#121212' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
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