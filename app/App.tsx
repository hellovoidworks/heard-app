import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { CategoryProvider } from './src/contexts/CategoryContext';
import AppNavigator from './src/navigation';
import { supabase } from './src/services/supabase';
import { Linking, Platform, Alert, LogBox, View, Text, ActivityIndicator, AppState } from 'react-native';
import { darkTheme } from './src/utils/theme';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { fontsToLoad } from './src/utils/fonts';
import * as Notifications from 'expo-notifications';

console.log('=== App initialization started ===');

// Expo notifications are automatically initialized in the notifications.ts file
console.log('Expo notifications configured');

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
    
    // --- Add AppState listener to clear notification badge ---
    const handleAppStateChange = async (nextAppState: any) => {
      if (nextAppState === 'active') {
        console.log('App has come to the foreground, clearing badge count.');
        await Notifications.setBadgeCountAsync(0);
      }
    };

    // Clear badge immediately on app load
    Notifications.setBadgeCountAsync(0);

    // Subscribe to AppState changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    // --- End AppState listener ---

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
      subscription.remove();
      authListener?.subscription?.unsubscribe();
      appStateSubscription.remove();
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
            <AppNavigator />
          </CategoryProvider>
        </AuthProvider>
      </PaperProvider>
    </View>
  );
}
