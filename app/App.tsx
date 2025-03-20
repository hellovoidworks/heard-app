import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation';
import { supabase } from './src/services/supabase';
import { Linking, Platform, Alert, LogBox, View, Text, ActivityIndicator } from 'react-native';

console.log('=== App initialization started ===');

// Ignore specific harmless warnings
LogBox.ignoreLogs([
  'Warning: ...',
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested'
]); 

export default function App() {
  console.log('=== App component rendering ===');
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<Error | null>(null);
  
  // Add a timeout to prevent infinite initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initializing) {
        console.log('=== App initialization timeout reached, forcing continue ===');
        setInitializing(false);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [initializing]);
  
  useEffect(() => {
    console.log('=== App useEffect running ===');
    
    const initializeApp = async () => {
      try {
        // Ensure Supabase is initialized
        if (!supabase) {
          throw new Error('Supabase client failed to initialize');
        }
        
        // Initialize any app-level services here
        
        // Mark app as initialized
        setInitializing(false);
      } catch (error) {
        console.error('=== App initialization error ===', error);
        setInitError(error as Error);
        setInitializing(false);
      }
    };
    
    initializeApp();
    
    // Handle deep linking for magic link authentication
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);
      
      if (url && url.includes('auth/callback')) {
        console.log('Auth callback detected in URL');
        
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
                  // Continue anyway, as AuthContext will retry profile creation
                }
              }
              
              // Force refresh the auth state
              setTimeout(() => {
                console.log('Showing success alert after auth');
                Alert.alert('Success', 'You have been successfully authenticated!');
              }, 500);
              
            } catch (sessionError: any) {
              console.error('Exception setting session:', sessionError);
              Alert.alert('Authentication Error', 'Failed to establish your session.');
            }
          } else {
            console.error('Missing tokens in URL');
            Alert.alert('Authentication Error', 'The authentication link is invalid or expired.');
          }
        } catch (err) {
          console.error('Exception handling deep link:', err);
          Alert.alert('Authentication Error', 'An error occurred while processing the authentication link.');
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
      
      // If user just signed in, ensure we have their profile
      if (event === 'SIGNED_IN' && session) {
        console.log('User just signed in, checking for profile');
        (async () => {
          try {
            const { data: profileData, error } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('id', session.user.id)
              .single();
              
            if (error) {
              console.log('No profile found for newly signed in user, creating one');
              const email = session.user.email || 'user';
              const username = email.split('@')[0]; 
              
              try {
                await supabase
                  .from('user_profiles')
                  .insert([
                    { 
                      id: session.user.id,
                      username: username,
                      onboarding_completed: false,
                      notification_preferences: { enabled: false }
                    }
                  ]);
                console.log('Created profile for newly signed in user');
              } catch (createError) {
                console.error('Error creating profile after sign in:', createError);
              }
            } else {
              console.log('Profile exists for newly signed in user');
            }
          } catch (e) {
            console.error('Error checking profile after sign in:', e);
          }
        })();
      }
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
    };
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ marginTop: 10 }}>Starting Heard...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', fontSize: 18, marginBottom: 10 }}>
          Error starting app
        </Text>
        <Text>{initError.message}</Text>
      </View>
    );
  }

  console.log('=== Rendering App component with providers ===');
  return (
    <PaperProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </PaperProvider>
  );
}
