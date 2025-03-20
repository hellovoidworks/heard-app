import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation';
import { supabase } from './src/services/supabase';
import { Linking, Platform, Alert } from 'react-native';

export default function App() {
  useEffect(() => {
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
              const { data: sessionData, error } = await supabase.auth.setSession({
                refresh_token: refreshToken,
                access_token: accessToken,
              });
              
              if (error) {
                console.error('Error setting session:', error);
                Alert.alert('Authentication Error', 'Failed to authenticate with the provided link.');
                return;
              }
              
              console.log('Session set successfully');
              
              // Get the current session immediately to ensure we have the user
              const { data: sessionCheckData } = await supabase.auth.getSession();
              if (!sessionCheckData?.session?.user) {
                console.error('Session set but user not available');
                Alert.alert('Authentication Error', 'Failed to retrieve user data after authentication.');
                return;
              }
              
              const userId = sessionCheckData.session.user.id;
              console.log('User authenticated:', sessionCheckData.session.user.email);
              
              // Check if profile exists already
              const { data: existingProfile, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, username, onboarding_completed')
                .eq('id', userId)
                .single();
                
              if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error checking for existing profile:', profileError);
              }
              
              if (existingProfile) {
                console.log('User profile exists:', existingProfile.username);
              } else {
                // If profile doesn't exist, explicitly create one
                console.log('No profile found, creating one...');
                
                // Get user's email for username
                const email = sessionCheckData.session.user.email || 'user';
                const username = email.split('@')[0]; // Use part before @ as default username
                
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
              }
              
              // Force refresh the auth state
              setTimeout(() => {
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
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('URL event received while app is open:', url);
      handleDeepLink(url);
    });

    // Handle deep links that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink(url);
      }
    });

    // Add a listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? `User authenticated: ${session.user.email}` : 'No session');
    });

    // Check for an existing session on app start
    const checkSession = async () => {
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
    };
    
    checkSession();

    return () => {
      subscription.remove();
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <PaperProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </PaperProvider>
  );
}
