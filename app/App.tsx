import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from './src/navigation/types';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { CategoryProvider } from './src/contexts/CategoryContext';
import { PreloadProvider } from './src/contexts/PreloadContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import AppNavigator from './src/navigation';
import StarRewardAnimation from './src/components/StarRewardAnimation';
import { supabase } from './src/services/supabase';
import { Linking, Platform, Alert, LogBox, View, Text, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { darkTheme } from './src/utils/theme';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { fontsToLoad } from './src/utils/fonts';
// Import Adjust with same pattern as in EmailSignInScreen.tsx
import { Adjust, AdjustConfig, AdjustEvent } from 'react-native-adjust';

console.log('=== App initialization started ===');

// Expo notifications are automatically initialized in the notifications.ts file
console.log('Expo notifications configured');

// Create a ref for navigation
const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// Last notification response handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Function to navigate based on notification data
function navigateToNotification(data: any) {
  if (!navigationRef.current || !data) return;
  
  console.log('Navigating based on notification data:', data);
  
  try {
    const type = data.type;
    const letterId = data.letter_id;
    const senderId = data.sender_id;
    
    // For new_mail notifications, we don't need a letter ID
    if (!letterId && type !== 'new_mail') {
      console.log('No letter ID in notification data');
      return;
    }
    
    // Get the current navigation state to preserve history
    const currentState = navigationRef.current.getRootState();
    console.log('Current navigation state:', JSON.stringify(currentState, null, 2));
    
    switch (type) {
      case 'reply':
        // Use modal presentation for reply notifications
        navigationRef.current?.navigate('ThreadDetail', { 
          letterId: letterId,
          otherParticipantId: senderId,
          presentationMode: 'modal'
        });
        break;
      case 'letter':
        // Push the LetterDetail screen onto the stack
        navigationRef.current?.dispatch(
          CommonActions.navigate({
            name: 'LetterDetail',
            params: { letterId: letterId }
          })
        );
        break;
      case 'reaction':
        // Use modal presentation for reaction notifications
        navigationRef.current?.navigate('MyLetterDetail', { 
          letterId: letterId,
          presentationMode: 'modal'
        });
        break;
      case 'new_mail':
        // Navigate to the home screen for new mail notifications
        console.log('Navigating to home screen for new mail notification');
        // Reset the navigation state to ensure we're on the Home tab
        navigationRef.current?.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              { name: 'Main' }
            ],
          })
        );
        break;
      default:
        console.log('Unknown notification type:', type);
    }
  } catch (error) {
    console.error('Error navigating to notification:', error);
  }
}

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

// Ignore specific harmless warnings
LogBox.ignoreLogs([
  'Warning: ...',
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested'
]); 

export default function App() {
  console.log('=== App component rendering ===');
  // This reference will be passed to AuthProvider to force a reset when needed
  const [forceReset, setForceReset] = useState(0);
  // State to show a loading screen during Magic Link auth
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  
  // Load the fonts
  const [fontsLoaded] = useFonts(fontsToLoad);
  
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Hide splash screen once fonts are loaded
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);
  
  useEffect(() => {
    console.log('=== App useEffect running ===');
    
    // Initialize Adjust SDK exactly as shown in the documentation example
    try {
      console.log('Attempting to initialize Adjust SDK...');
      
      // Create the config object exactly as shown in the documentation
      const adjustConfig = new AdjustConfig(
        'k65lvn10qqdc',
        AdjustConfig.EnvironmentSandbox
      );
      
      // Initialize the SDK
      Adjust.initSdk(adjustConfig);
      console.log('Adjust SDK initialized successfully');
      
      // Track session_start event when app is first opened
      const startEvent = new AdjustEvent('xe30he');
      Adjust.trackEvent(startEvent);
    } catch (error) {
      console.error('Error initializing Adjust SDK:', error);
    }
    
    // Set up AppState handler to track app foreground/background states
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // App came to foreground - track session_start
        console.log('App became active - tracking session_start event');
        const startEvent = new AdjustEvent('xe30he');
        Adjust.trackEvent(startEvent);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - track session_end
        console.log('App went to background - tracking session_end event');
        const endEvent = new AdjustEvent('h3oew9');
        Adjust.trackEvent(endEvent);
      }
    });
    
    // Set up notification response handler
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const data = response.notification.request.content.data;
      navigateToNotification(data);
    });
    
    // Check if app was opened from a notification
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        console.log('App opened from notification:', response);
        const data = response.notification.request.content.data;
        // Small delay to ensure navigation is ready
        setTimeout(() => navigateToNotification(data), 1000);
      }
    });
    
    // Handle deep linking for magic link authentication
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);
      
      if (url && url.includes('auth/callback')) {
        console.log('Auth callback detected in URL');
        // Show loading overlay during Magic Link auth
        setMagicLinkLoading(true);
        
        try {
          // Extract the refresh token and access token from the URL
          const params = new URLSearchParams(url.split('#')[1]);
          const refreshToken = params.get('refresh_token');
          const accessToken = params.get('access_token');
          
          console.log('Tokens extracted:', 
            refreshToken ? 'Refresh token found' : 'No refresh token', 
            accessToken ? 'Access token found' : 'No access token'
          );
          
          if (refreshToken && accessToken) {
            // Set the auth session in Supabase
            console.log('Setting session with tokens');
            
            try {
              console.log('Before setSession call');
              const { data: sessionData, error } = await supabase.auth.setSession({
                refresh_token: refreshToken,
                access_token: accessToken,
              });
              console.log('After setSession call, success:', !error, 'sessionData exists:', !!sessionData);
              
              if (error) {
                console.error('Error setting session:', error);
                Alert.alert('Authentication Error', 'Failed to authenticate with the provided link.');
                setMagicLinkLoading(false);
                return;
              }
              
              console.log('Session set successfully');
              
              // Get the current session immediately to ensure we have the user
              console.log('Getting current session to verify user');
              const { data: sessionCheckData } = await supabase.auth.getSession();
              console.log('Session check complete, user exists:', !!sessionCheckData?.session?.user);
              
              if (!sessionCheckData?.session?.user) {
                console.error('Session set but user not available');
                Alert.alert('Authentication Error', 'Failed to retrieve user data after authentication.');
                setMagicLinkLoading(false);
                return;
              }
              
              const userId = sessionCheckData.session.user.id;
              console.log('User authenticated:', sessionCheckData.session.user.email, 'with ID:', userId);
              
              // Check if profile exists already
              console.log('Checking if user profile exists');
              const { data: existingProfile, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, username, onboarding_completed')
                .eq('id', userId)
                .single();
                
              if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error checking for existing profile:', profileError);
              }
              
              if (existingProfile) {
                console.log('User profile exists:', existingProfile.username, 'onboarding completed:', existingProfile.onboarding_completed);
              } else {
                // If profile doesn't exist, explicitly create one
                console.log('No profile found, creating one...');
                
                // Get user's email for username
                const email = sessionCheckData.session.user.email || 'user';
                const username = email.split('@')[0]; // Use part before @ as default username
                
                console.log('Creating profile with username:', username);
                try {
                  const { data: newProfile, error: createError } = await supabase
                    .from('user_profiles')
                    .insert([
                      { 
                        id: userId,
                        username: username,
                        onboarding_completed: false,
                        notification_preferences: { enabled: false }
                      }
                    ])
                    .select()
                    .single();
                    
                  if (createError) {
                    console.error('Error creating profile:', createError);
                    // Continue anyway, as the DB trigger might still create it
                  } else {
                    console.log('Profile created successfully:', newProfile?.username);
                  }
                } catch (createProfileError) {
                  console.error('Exception creating profile:', createProfileError);
                }
              }
              
              // Force reset the auth context to refresh the state
              console.log('Forcing reset of auth context');
              setForceReset(prev => prev + 1);
              
              // Remove loading state after a short delay
              setTimeout(() => {
                console.log('Authentication complete');
                setMagicLinkLoading(false);
              }, 1500);
              
            } catch (sessionError: any) {
              console.error('Exception setting session:', sessionError);
              Alert.alert('Authentication Error', 'Failed to establish your session.');
              setMagicLinkLoading(false);
            }
          } else {
            console.error('Missing tokens in URL');
            Alert.alert('Authentication Error', 'The authentication link is invalid or expired.');
            setMagicLinkLoading(false);
          }
        } catch (err) {
          console.error('Exception handling deep link:', err);
          Alert.alert('Authentication Error', 'An error occurred while processing the authentication link.');
          setMagicLinkLoading(false);
        }
      }
    };

    // Handle deep links when the app is already open
    console.log('Setting up deep link listener');
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('URL event received while app is open:', url);
      handleDeepLink(url);
    });

    // Handle deep links that opened the app
    console.log('Checking for initial URL');
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink(url);
      } else {
        console.log('No initial URL found');
      }
    });

    // Add a listener for auth state changes
    console.log('Setting up auth state listener');
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? `User authenticated: ${session.user.email}` : 'No session');
    });

    // Check for an existing session on app start
    const checkSession = async () => {
      console.log('=== Checking for existing session ===');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error checking session:', error);
        } else if (data?.session) {
          console.log('Existing session found:', data.session.user.email);
        } else {
          console.log('No existing session found');
        }
      } catch (e) {
        console.error('Exception checking session:', e);
      }
      console.log('=== Session check complete ===');
    };
    
    checkSession();

    return () => {
      console.log('Cleaning up App component listeners');
      
      // Clean up Adjust SDK exactly as shown in the documentation
      try {
        console.log('Cleaning up Adjust SDK...');
        Adjust.componentWillUnmount();
        console.log('Adjust SDK cleanup completed');
      } catch (error) {
        console.error('Error cleaning up Adjust SDK:', error);
      }
      
      // Clean up other listeners
      subscription.remove();
      authListener?.subscription?.unsubscribe();
      notificationResponseSubscription.remove();
      appStateSubscription.remove(); // Clean up the AppState listener
    };
  }, []);

  console.log('=== Rendering App component with providers ===');
  
  // Show loading screen if fonts aren't loaded yet or during magic link authentication
  if (!fontsLoaded || magicLinkLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#161616'
      }}>
        <ActivityIndicator size="large" color="#476EF1" />
        <Text style={{ marginTop: 15, color: '#FFFFFF', fontSize: 16 }}>
          {magicLinkLoading ? 'Signing you in...' : 'Loading...'}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: '#161616' }} onLayout={onLayoutRootView}>
      <PaperProvider theme={darkTheme}>
        <AuthProvider key={`auth-provider-${forceReset}`}>
          <CategoryProvider>
            <NotificationProvider>
              <PreloadProvider>
                <AppNavigator ref={navigationRef} />
                {/* Position the star reward animation component with absolute positioning and highest z-index */}
                <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'box-none', // Allow touches to pass through when no animation is showing
                zIndex: 9999,
                elevation: 10,
              }}>
                <StarRewardAnimation />
              </View>
              </PreloadProvider>
            </NotificationProvider>
          </CategoryProvider>
        </AuthProvider>
      </PaperProvider>
    </View>
  );
}
