import React, { createContext, useState, useContext, useEffect } from 'react';
import eventEmitter, { EVENTS } from '../utils/eventEmitter';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { AppState, AppStateStatus } from 'react-native';
import { generateUniqueRandomUsername, isUsernameUnique } from '../utils/usernameGenerator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { updateAppBadgeCount } from '../services/notifications';

console.log('=== AuthContext module initialized ===');

// Define the profile interface
interface Profile {
  id: string;
  username: string;
  birthdate?: string;
  onboarding_step?: string;
  onboarding_completed?: boolean;
  stars: number;
  notification_preferences?: {
    enabled: boolean;
    new_replies?: boolean;
    new_reactions?: boolean;
    system_announcements?: boolean;
    [key: string]: any; // Allow for future notification types
  };
  created_at?: string;
  updated_at?: string;
}

// Define the update profile params
interface UpdateProfileParams {
  username: string;
}

interface AuthContextData {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
  isOnboardingComplete: boolean | null;
  checkOnboardingStatus: () => Promise<boolean>;
  updateProfile: (params: UpdateProfileParams) => Promise<{ error: Error | null }>;
  updateStars: (amount: number) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('=== AuthProvider rendering ===');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);

  // Fetch user profile from Supabase
  const fetchProfile = async (userId: string, retryCount = 0, delay = 500): Promise<Profile | null> => {
    try {
      console.log(`AuthContext: Fetching profile for user ${userId} (retry: ${retryCount})`);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.code, error.message);
        
        // If no profile found and we haven't exceeded max retries,
        // wait and try again (useful for Magic Link auth where profile creation
        // might happen after auth state change)
        if (error.code === 'PGRST116' && retryCount < 3) {
          console.log(`AuthContext: Profile not found, retrying in ${delay}ms...`);
          
          return new Promise((resolve) => {
            setTimeout(async () => {
              const result = await fetchProfile(userId, retryCount + 1, delay * 1.5);
              resolve(result);
            }, delay);
          });
        }
        
        return null;
      }

      console.log('AuthContext: Profile fetched successfully', data);
      return data as Profile;
    } catch (error) {
      console.error('Exception fetching profile:', error);
      
      // Retry on exception too if we haven't exceeded max retries
      if (retryCount < 3) {
        console.log(`AuthContext: Exception occurred, retrying in ${delay}ms...`);
        
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await fetchProfile(userId, retryCount + 1, delay * 1.5);
            resolve(result);
          }, delay);
        });
      }
      
      return null;
    }
  };

  useEffect(() => {
    console.log('=== AuthProvider useEffect running ===');
    // Check for active session on mount
    const checkSession = async () => {
      try {
        console.log('AuthContext: Checking for active session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          // Check if this is the "Invalid Refresh Token" error which is expected when no user is logged in
          const isRefreshTokenError = error.message?.includes('Invalid Refresh Token') || 
                                    error.message?.includes('Refresh Token Not Found');
          
          if (isRefreshTokenError) {
            // This is an expected condition when no user is logged in, not a true error
            console.log('AuthContext: No active session (refresh token not found)');
            setLoading(false);
            return; // Continue with no user
          } else {
            // This is an unexpected error, log it as an error
            console.error('AuthContext: Error checking session:', error);
            setLoading(false);
            return; // Don't throw, just return and let the app continue
          }
        }
        
        if (data?.session?.user) {
          console.log('AuthContext: Active session found for user:', data.session.user.email);
          setUser(data.session.user);
          
          try {
            // Fetch user profile
            console.log('AuthContext: Fetching profile for active session');
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', data.session.user.id)
              .single();
            
            if (profileError) {
              console.error('AuthContext: Error fetching profile for active session:', profileError);
              
              // If no profile found, create one immediately
              if (profileError.code === 'PGRST116') {
                console.log('AuthContext: No profile found for active session, creating one');
                
                // Generate a unique random username
                const username = await generateUniqueRandomUsername(supabase) || `User${Math.floor(Math.random() * 10000)}`;
                console.log('AuthContext: Generated random username:', username);
                
                const { error: createError } = await supabase
                  .from('user_profiles')
                  .insert([{
                    id: data.session.user.id,
                    username,
                    onboarding_completed: false,
                    notification_preferences: { enabled: false }
                  }]);
                
                if (createError) {
                  console.error('AuthContext: Error creating profile during session check:', createError);
                  setLoading(false);
                  return;
                }
                
                // Fetch the newly created profile
                const { data: newProfile, error: fetchNewError } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('id', data.session.user.id)
                  .single();
                
                if (fetchNewError) {
                  console.error('AuthContext: Error fetching newly created profile:', fetchNewError);
                  setLoading(false);
                  return;
                }
                
                // Set profile and onboarding status
                setProfile(newProfile);
                setIsOnboardingComplete(newProfile?.onboarding_completed === true);
                console.log('AuthContext: Created and set profile for active session');
              } else {
                setLoading(false);
                return;
              }
            } else {
              // Profile found, set it
              console.log('AuthContext: Profile found for active session:', profileData?.username);
              setProfile(profileData);
              setIsOnboardingComplete(profileData?.onboarding_completed === true);
            }
          } catch (e) {
            console.error('AuthContext: Exception during profile fetch:', e);
          }
        } else {
          console.log('AuthContext: No active session found');
          setIsOnboardingComplete(null);
        }
      } catch (error) {
        console.error('AuthContext: Error checking session:', error);
      } finally {
        console.log('AuthContext: Setting loading to false after session check');
        setLoading(false);
      }
    };

    // Create a timeout to ensure loading state doesn't get stuck
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.log('AuthContext: Force ending loading state after timeout');
        setLoading(false);
      }
    }, 5000);

    checkSession();

    // Set up auth state listener
    console.log('AuthContext: Setting up auth state change listener');
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`AuthContext: Auth event received: ${event}`);

        switch (event) {
          case 'INITIAL_SESSION':
            console.log('AuthContext: Initial session established.');
            break;
          case 'SIGNED_IN':
            console.log('AuthContext: User signed in.');
            break;
          case 'SIGNED_OUT':
            console.log('AuthContext: User signed out.');
            setProfile(null);
            setUser(null);
            setIsOnboardingComplete(null);
            
            // Clear notification badge and AsyncStorage
            updateAppBadgeCount(0).catch(err => 
              console.error('AuthContext: Error clearing badge on sign out:', err)
            );
            
            // Clear relevant AsyncStorage items
            const keysToRemove = [
              '@heard_app/last_star_count',
              '@heard_app/last_star_reward',
              '@heard_app/pending_star_reward'
            ];
            
            Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)))
              .catch(err => console.error('AuthContext: Error clearing AsyncStorage on sign out:', err));
              
            return; // No further profile fetching needed on sign out
          case 'PASSWORD_RECOVERY':
            console.log('AuthContext: Password recovery event.');
            break;
          case 'TOKEN_REFRESHED':
            console.log('AuthContext: Token refreshed successfully.');
            if (session) {
              // Check if expires_at exists before using it
              if (session.expires_at) {
                console.log(`AuthContext: New token expires at: ${new Date(session.expires_at * 1000).toISOString()}`);
              } else {
                console.warn('AuthContext: TOKEN_REFRESHED event, session exists but expires_at is missing.');
              }
            } else {
              console.warn('AuthContext: TOKEN_REFRESHED event received but session is null.');
            }
            break;
          case 'USER_UPDATED':
            console.log('AuthContext: User details updated.');
            break;
          default:
            console.log(`AuthContext: Unhandled auth event: ${event}`);
        }

        if (session?.user) {
          console.log('AuthContext: Session exists. User authenticated:', session.user.email, 'ID:', session.user.id);
          setUser(session.user);
          
          // IMPORTANT: Do not make Supabase API calls directly in the auth state change handler
          // Instead, use setTimeout to schedule the profile fetch after the auth state change is complete
          // This prevents side effects as documented in Supabase docs: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 100);
        } else {
          console.log('AuthContext: No user session after auth state change');
          setUser(null);
          setProfile(null);
          setIsOnboardingComplete(null);
        }
        
        console.log('AuthContext: Setting loading to false after auth state change');
        setLoading(false);
      }
    );

    // Set up AppState listener to manage auto refresh as recommended by Supabase docs
    console.log('AuthContext: Setting up AppState listener for token auto-refresh');
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log(`AuthContext: AppState changed to ${nextAppState}`);
      
      if (nextAppState === 'active') {
        // Before starting auto-refresh, check if there's actually a user session
        // This prevents unnecessary refresh token errors when no user is logged in
        supabase.auth.getSession().then(({ data, error }) => {
          // Only start auto-refresh if there's a valid session
          if (data?.session && !error) {
            console.log('AuthContext: App is active with valid session, starting auto refresh');
            supabase.auth.startAutoRefresh();
          } else {
            // Don't log as error if it's just a missing refresh token
            const isRefreshTokenError = error?.message?.includes('Invalid Refresh Token') || 
                                        error?.message?.includes('Refresh Token Not Found');
            
            if (error && !isRefreshTokenError) {
              console.error('AuthContext: Error checking session for auto-refresh:', error);
            } else {
              console.log('AuthContext: No valid session for auto-refresh');
            }
          }
        }).catch(error => {
          console.log('AuthContext: Error during session check for auto-refresh:', error);
        });
      } else {
        console.log('AuthContext: App is inactive/background, stopping auto refresh');
        supabase.auth.stopAutoRefresh();
      }
    });
    
    // Start auto refresh immediately since the app is active when mounting this component
    console.log('AuthContext: Initial app state is active, starting auto refresh');
    supabase.auth.startAutoRefresh();

    return () => {
      console.log('AuthContext: Cleaning up auth listener');
      clearTimeout(loadingTimeout);
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
      
      // Clean up AppState listener
      console.log('AuthContext: Cleaning up AppState listener');
      appStateSubscription.remove();
      
      // Stop auto refresh when unmounting
      console.log('AuthContext: Stopping auto refresh during cleanup');
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // Helper function to fetch user profile - extracted from auth state change handler
  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('AuthContext: Fetching profile for user:', userId);
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('AuthContext: Error fetching profile:', profileError);
        
        // If no profile found, create one immediately
        if (profileError.code === 'PGRST116') {
          console.log('AuthContext: No profile found, creating one');
          
          // Generate a unique random username
          const username = await generateUniqueRandomUsername(supabase) || `User${Math.floor(Math.random() * 10000)}`;
          console.log('AuthContext: Generated random username:', username);
          
          const { error: createError } = await supabase
            .from('user_profiles')
            .insert([{
              id: userId,
              username,
              onboarding_completed: false,
              notification_preferences: { enabled: false }
            }]);
          
          if (createError) {
            console.error('AuthContext: Error creating profile:', createError);
            setLoading(false);
            return;
          }
          
          // Fetch the newly created profile
          const { data: newProfile, error: fetchNewError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (fetchNewError) {
            console.error('AuthContext: Error fetching newly created profile:', fetchNewError);
            setLoading(false);
            return;
          }
          
          // Set profile and onboarding status
          setProfile(newProfile);
          setIsOnboardingComplete(newProfile?.onboarding_completed === true);
          console.log('AuthContext: Created and set profile');
        } else {
          setLoading(false);
          return;
        }
      } else {
        // Profile found, set it
        console.log('AuthContext: Profile found:', profileData?.username);
        setProfile(profileData);
        setIsOnboardingComplete(profileData?.onboarding_completed === true);
      }
    } catch (e) {
      console.error('AuthContext: Exception during profile fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  // Simplified signIn function that directly fetches or creates the profile
  const signIn = async (newUser: User) => {
    console.log('AuthContext: Manual sign in for user:', newUser.email, 'ID:', newUser.id);
    setUser(newUser);
    setLoading(true);
    
    try {
      // Directly fetch the profile
      console.log('AuthContext: Fetching profile during manual sign in');
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', newUser.id)
        .single();
        
      if (profileError) {
        console.error('AuthContext: Error fetching profile during manual sign in:', profileError);
        
        // If profile not found, create one
        if (profileError.code === 'PGRST116') {
          console.log('AuthContext: No profile found during manual sign in, creating one');
          
          // Generate a unique random username
          const username = await generateUniqueRandomUsername(supabase) || `User${Math.floor(Math.random() * 10000)}`;
          console.log('AuthContext: Generated random username:', username);
          
          const { error: createError } = await supabase
            .from('user_profiles')
            .insert([{ 
              id: newUser.id,
              username,
              onboarding_completed: false,
              notification_preferences: { enabled: false }
            }]);
            
          if (createError) {
            console.error('AuthContext: Error creating profile during manual sign in:', createError);
            setLoading(false);
            return;
          }
          
          // Fetch the newly created profile
          const { data: newProfile, error: fetchNewError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', newUser.id)
            .single();
            
          if (fetchNewError) {
            console.error('AuthContext: Error fetching newly created profile during manual sign in:', fetchNewError);
            setLoading(false);
            return;
          }
          
          // Set profile and onboarding status
          setProfile(newProfile);
          setIsOnboardingComplete(newProfile?.onboarding_completed === true);
          console.log('AuthContext: Created and set profile during manual sign in');
        }
      } else {
        // Profile found, set it
        console.log('AuthContext: Profile found during manual sign in:', profileData?.username);
        setProfile(profileData);
        setIsOnboardingComplete(profileData?.onboarding_completed === true);
      }
    } catch (e) {
      console.error('AuthContext: Exception during profile fetch in manual sign in:', e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Signing out user');
      
      // Clear React state first to prevent any UI issues during sign-out
      setUser(null);
      setProfile(null);
      setIsOnboardingComplete(null);
      
      // Clear notification badge
      console.log('AuthContext: Clearing notification badge');
      await updateAppBadgeCount(0);
      
      // Clear relevant AsyncStorage items
      console.log('AuthContext: Clearing AsyncStorage items');
      const keysToRemove = [
        '@heard_app/last_star_count',
        '@heard_app/last_star_reward',
        '@heard_app/pending_star_reward',
        // Add any other auth-related AsyncStorage keys here
      ];
      
      await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
      
      // Additional cleanup specific to auth state
      // This helps address persistent session issues after sign-out
      await SecureStore.deleteItemAsync('supabase-auth-token');
      
      // Now sign out from Supabase with session kill option
      // This ensures the token is invalidated server-side
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all devices/tabs
      });
      
      if (error) {
        console.error('AuthContext: Error signing out from Supabase:', error);
        throw error;
      }
      
      console.log('AuthContext: User signed out successfully');
    } catch (error) {
      console.error('AuthContext: Error during sign out process:', error);
      // Even if there's an error, we want to make sure the UI is reset
      setUser(null);
      setProfile(null);
      setIsOnboardingComplete(null);
      throw error;
    }
  };

  const checkOnboardingStatus = async (): Promise<boolean> => {
    if (!user) {
      console.log('AuthContext: No user to check onboarding status for');
      return false;
    }
    
    try {
      console.log('AuthContext: Checking onboarding status for user:', user.id);
      // Direct database query to check onboarding status
      const { data, error } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('AuthContext: Error checking onboarding status:', error);
        return false;
      }
      
      const onboardingComplete = data?.onboarding_completed === true;
      console.log('AuthContext: Onboarding status check result:', onboardingComplete);
      setIsOnboardingComplete(onboardingComplete);
      return onboardingComplete;
    } catch (error) {
      console.error('AuthContext: Error checking onboarding status:', error);
      return false;
    }
  };

  const updateProfile = async (params: UpdateProfileParams): Promise<{ error: Error | null }> => {
    if (!user) {
      console.log('AuthContext: Cannot update profile - user not authenticated');
      return { error: new Error('User not authenticated') };
    }

    try {
      console.log('AuthContext: Updating profile for user:', user.id, 'with params:', params);
      
      // Check if the new username is unique (unless it's the same as the current username)
      if (profile && params.username !== profile.username) {
        const isUnique = await isUsernameUnique(params.username, supabase);
        if (!isUnique) {
          console.error('AuthContext: Username already exists:', params.username);
          return { error: new Error('Username already exists. Please choose a different username.') };
        }
      }
      
      // With the database trigger, we can assume the profile always exists
      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: params.username,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        console.error('AuthContext: Error updating profile:', error);
        return { error: new Error(error.message) };
      }
      
      console.log('AuthContext: Profile updated successfully, fetching updated profile');
      
      // Fetch updated profile directly
      const { data: updatedProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (fetchError) {
        console.error('AuthContext: Error fetching updated profile:', fetchError);
        return { error: new Error(fetchError.message) };
      }
      
      setProfile(updatedProfile);
      console.log('AuthContext: Updated profile:', updatedProfile);
      
      return { error: null };
    } catch (error: any) {
      console.error('AuthContext: Exception updating profile:', error);
      return { error };
    }
  };

  const updateStars = async (amount: number): Promise<{ error: Error | null }> => {
    if (!user || !profile) {
      console.log('AuthContext: Cannot update stars - user not authenticated or no profile');
      return { error: new Error('User not authenticated or no profile') };
    }

    try {
      console.log('AuthContext: Updating stars for user:', user.id, 'by amount:', amount);
      
      // Update the stars in the database
      const { error } = await supabase
        .from('user_profiles')
        .update({
          stars: profile.stars + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        console.error('AuthContext: Error updating stars:', error);
        return { error: new Error(error.message) };
      }
      
      // Fetch updated profile to get the new star count
      const { data: updatedProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (fetchError) {
        console.error('AuthContext: Error fetching updated profile:', fetchError);
        return { error: new Error(fetchError.message) };
      }
      
      setProfile(updatedProfile);
      console.log('AuthContext: Updated profile with new star count:', updatedProfile.stars);
      
      // Emit event for star count change - for the StarIndicator component
      eventEmitter.emit(EVENTS.STARS_UPDATED, updatedProfile.stars);
      
      // Also emit the STAR_REWARD_EARNED event with the amount that was just awarded
      // This will trigger the star reward animation
      if (amount > 0) {
        console.log('AuthContext: Emitting STAR_REWARD_EARNED event with amount:', amount);
        eventEmitter.emit(EVENTS.STAR_REWARD_EARNED, amount);
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('AuthContext: Exception updating stars:', error);
      return { error };
    }
  };

  console.log('AuthContext: Current state:', { 
    hasUser: !!user, 
    hasProfile: !!profile, 
    loading, 
    isOnboardingComplete 
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      loading, 
      signIn, 
      signOut, 
      isOnboardingComplete,
      checkOnboardingStatus,
      updateProfile,
      updateStars
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 