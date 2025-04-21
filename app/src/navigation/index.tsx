import React, { useEffect, forwardRef } from 'react';
import { NavigationContainer, DarkTheme, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { registerForPushNotificationsAsync, savePushToken } from '../services/notifications';
import { Ionicons } from '@expo/vector-icons';
import linking from '../utils/linking';
import { supabase } from '../services/supabase';
import { CommonActions } from '@react-navigation/native';
import { View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontNames } from '../utils/fonts';
import StarIndicator from '../components/StarIndicator';

// Import screens from the index file
import {
  LoginScreen,
  HomeScreen,
  ProfileScreen,
  NotificationsScreen,
  WriteLetterScreen,
  WriteLetterContentScreen,
  WriteLetterDetailsScreen,
  LetterDetailScreen,
  MyLetterDetailScreen,
  ThreadDetailScreen,
  MailboxScreen,
  NotificationSettingsScreen,
  CategoryPreferencesSettingsScreen,
  DeleteAccountScreen,
  WebViewScreen
} from '../screens';

// Import onboarding screens
import {
  AgeVerificationScreen,
  CategoryPreferencesScreen,
  NotificationPermissionScreen
} from '../screens/onboarding';

// Import navigation types
import { RootStackParamList, AuthStackParamList, MainTabParamList, OnboardingStackParamList } from './types';

// Import new screens
import EmailSignInScreen from '../screens/auth/EmailSignInScreen';

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
      contentStyle: { backgroundColor: '#161616' }
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="EmailSignIn" component={EmailSignInScreen} />
  </AuthStack.Navigator>
);

// Onboarding navigator
const OnboardingNavigator = () => {
  console.log('Rendering OnboardingNavigator');
  return (
    <OnboardingStack.Navigator 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#161616' }
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
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { totalUnreadCount } = useNotification();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#161616',
        },
        headerShadowVisible: false,
        headerTintColor: '#FFFFFF',
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 60 + insets.bottom,
          backgroundColor: '#161616',
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#666666',
        headerTitleStyle: {
          fontFamily: fontNames.interSemiBold,
        },
      }}
      tabBar={props => (
        <View style={{
          flexDirection: 'row',
          height: 60 + insets.bottom,
          backgroundColor: '#161616',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: insets.bottom,
        }}>
          {/* Home Tab */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: insets.bottom > 0 ? insets.bottom / 3 : 0,
            }}
            onPress={() => props.navigation.navigate('Home')}
          >
            <Text style={{
              color: props.state.index === 0 ? '#FFFFFF' : '#666666',
              fontSize: 16,
              fontWeight: 'normal',
              textTransform: 'uppercase',
              fontFamily: fontNames.interMedium,
            }}>
              HOME
            </Text>
          </TouchableOpacity>

          {/* Write Button (Center) - Opens Write Screen as Modal */}
          <TouchableOpacity
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#476EF1',
              alignItems: 'center',
              justifyContent: 'center',
              bottom: 20,
              marginBottom: insets.bottom > 0 ? -insets.bottom / 2 : 0,
              borderWidth: 6,
              borderColor: '#121212',
            }}
            onPress={() => props.navigation.getParent()?.navigate('WriteLetterContent')}
          >
            <Ionicons name="add" size={30} color="white" />
          </TouchableOpacity>

          {/* Mailbox Tab */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: insets.bottom > 0 ? insets.bottom / 3 : 0,
            }}
            onPress={() => props.navigation.navigate('Mailbox')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{
                color: props.state.index === 1 ? '#FFFFFF' : '#666666',
                fontSize: 16,
                fontWeight: 'normal',
                textTransform: 'uppercase',
                fontFamily: fontNames.interMedium,
              }}>
                MAILBOX
              </Text>
              
              {/* Unread count badge */}
              {totalUnreadCount > 0 && (
                <View style={{
                  backgroundColor: 'red',
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: 5,
                  paddingHorizontal: 3,
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: '900',
                  }}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={({ navigation }) => ({
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontFamily: fontNames.interSemiBold
                }}
              >
                Today's Mail
              </Text>
              <Text
                style={{
                  color: '#888888',
                  fontSize: 18,
                  marginLeft: 8,
                  fontFamily: fontNames.interRegular
                }}
              >
                {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', ',')}
              </Text>
            </View>
          ),
          headerLeft: () => null,
          headerRight: () => {
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Star indicator with count */}
                <StarIndicator starCount={profile?.stars ?? 0} />
                {/* Profile button */}
                <Ionicons 
                  name="person-circle-outline" 
                  size={22} 
                  color="#FFFFFF"
                  style={{ marginRight: 15 }}
                  onPress={() => {
                    navigation.getParent()?.navigate('Profile');
                  }}
                />
              </View>
            );
          },
          headerStyle: {
            backgroundColor: '#161616',
          },
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTitleContainerStyle: {
            left: 8,
            right: 16,
            maxWidth: '70%',
          },
        })}
      />
      <Tab.Screen 
        name="Mailbox" 
        component={MailboxScreen} 
        options={({ navigation }) => ({
          headerTitle: () => null,
          headerLeft: () => null,
          headerRight: () => {
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Star indicator with count */}
                <StarIndicator starCount={profile?.stars ?? 0} />
                {/* Profile button */}
                <Ionicons 
                  name="person-circle-outline" 
                  size={22} 
                  color="#FFFFFF"
                  style={{ marginRight: 15 }}
                  onPress={() => {
                    navigation.getParent()?.navigate('Profile');
                  }}
                />
              </View>
            );
          },
          headerStyle: {
            backgroundColor: '#161616',
          },
          headerShadowVisible: false,
          headerTitleAlign: 'left',
        })}
      />
    </Tab.Navigator>
  );
};

// App root navigator
const AppNavigator = forwardRef<NavigationContainerRef<RootStackParamList>>((_, ref) => {
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
    <NavigationContainer 
      ref={ref}
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: '#161616',
          card: '#161616'
        }
      }} 
      linking={linking}>
      <Stack.Navigator screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#161616' },
        headerStyle: { 
          backgroundColor: '#161616',
        },
        headerShadowVisible: false,
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
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_bottom'
                }} 
              />
              <Stack.Screen 
                name="MyLetterDetail" 
                component={MyLetterDetailScreen} 
                options={({ navigation, route }) => {
                  // Check if we should present this as a modal
                  const { presentationMode } = route.params as { presentationMode?: 'modal' | 'push' };
                  const isModal = presentationMode === 'modal';
                  
                  return {
                    headerShown: isModal, // Show header only in modal mode
                    title: isModal ? 'My Mail' : '',
                    headerStyle: { backgroundColor: '#161616' },
                    headerTintColor: '#FFFFFF',
                    // For modal presentation, use a close button instead of back button
                    headerLeft: isModal ? () => (
                      <Ionicons 
                        name="close-outline" 
                        size={28} 
                        color="#FFFFFF" 
                        style={{ marginLeft: 5 }}
                        onPress={() => navigation.goBack()}
                      />
                    ) : undefined,
                    // If modal presentation is requested, set the presentation mode
                    presentation: isModal ? 'modal' : 'card',
                    // Use a different animation for modal
                    animation: isModal ? 'slide_from_bottom' : 'slide_from_right'
                  };
                }}
              />
              <Stack.Screen 
                name="ThreadDetail" 
                component={ThreadDetailScreen} 
                options={({ navigation, route }) => {
                  // Check if we should present this as a modal
                  const { presentationMode } = route.params as { presentationMode?: 'modal' | 'push' };
                  const isModal = presentationMode === 'modal';
                  
                  return {
                    headerShown: true,
                    title: '',
                    headerStyle: { backgroundColor: '#161616' },
                    headerTintColor: '#FFFFFF',
                    headerBackTitle: isModal ? undefined : 'Inbox',
                    // For modal presentation, use a close button instead of back button
                    headerLeft: isModal ? () => (
                      <Ionicons 
                        name="close-outline" 
                        size={28} 
                        color="#FFFFFF" 
                        style={{ marginLeft: 5 }}
                        onPress={() => navigation.goBack()}
                      />
                    ) : undefined,
                    // If modal presentation is requested, set the presentation mode
                    presentation: isModal ? 'modal' : undefined,
                    // Use a different animation for modal
                    animation: isModal ? 'slide_from_bottom' : 'default'
                  };
                }} 
              />
              <Stack.Screen 
                name="WriteLetter" 
                component={WriteLetterContentScreen} 
                options={({ navigation }) => ({ 
                  headerShown: true, 
                  title: 'Write Mail',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF',
                  presentation: 'card',
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
                name="WriteLetterContent" 
                component={WriteLetterContentScreen} 
                options={({ navigation }) => ({ 
                  headerShown: true, 
                  title: 'Write Mail',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF',
                  presentation: 'card',
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
                name="WriteLetterDetails" 
                component={WriteLetterDetailsScreen} 
                options={({ navigation }) => ({ 
                  headerShown: true, 
                  title: '',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF',
                  presentation: 'card',
                })} 
              />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Profile',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="Notifications" 
                component={NotificationsScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Notifications',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="NotificationSettings" 
                component={NotificationSettingsScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Notification Settings',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="CategoryPreferencesSettings" 
                component={CategoryPreferencesSettingsScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Category Preferences',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="DeleteAccount" 
                component={DeleteAccountScreen} 
                options={{ 
                  headerShown: true, 
                  title: 'Delete My Account',
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF'
                }} 
              />
              <Stack.Screen 
                name="WebView" 
                component={WebViewScreen} 
                options={({ route }) => ({ 
                  headerShown: true, 
                  title: route.params.title,
                  headerStyle: { backgroundColor: '#161616' },
                  headerTintColor: '#FFFFFF'
                })} 
              />
            </>
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
});

export default AppNavigator; 