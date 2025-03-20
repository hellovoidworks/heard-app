import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

console.log('=== AuthContext module initialized ===');

// Define the profile interface
interface Profile {
  id: string;
  username: string;
  birthdate?: string;
  onboarding_step?: string;
  onboarding_completed?: boolean;
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
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  isOnboardingComplete: boolean | null;
  checkOnboardingStatus: () => Promise<boolean>;
  updateProfile: (params: UpdateProfileParams) => Promise<{ error: Error | null }>;
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
        if (error.code === 'PGRST116' && retryCount < 5) {  // Increase max retries to 5
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
      if (retryCount < 5) {  // Increase max retries to 5
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
          console.error('AuthContext: Error checking session:', error);
          setLoading(false); // Ensure loading is set to false even on error
          throw error;
        }
        
        if (data?.session?.user) {
          console.log('AuthContext: Active session found for user:', data.session.user.email);
          setUser(data.session.user);
          
          // Fetch user profile with increased retries and longer delays for Magic Link
          const userProfile = await fetchProfile(data.session.user.id, 0, 1000);
          console.log('AuthContext: User profile after fetch:', userProfile ? 'found' : 'not found');
          
          if (!userProfile) {
            console.log('AuthContext: Profile not found, creating a default one');
            // Create a default profile if none exists to avoid white screen
            try {
              const email = data.session.user.email || 'user';
              const username = email.split('@')[0];
              
              const { error: createError } = await supabase
                .from('user_profiles')
                .insert([
                  { 
                    id: data.session.user.id,
                    username: username,
                    onboarding_completed: false,
                    notification_preferences: { enabled: false }
                  }
                ]);
                
              if (createError) {
                console.error('AuthContext: Error creating default profile:', createError);
              } else {
                console.log('AuthContext: Created default profile');
                // Fetch the newly created profile
                const newProfile = await fetchProfile(data.session.user.id);
                setProfile(newProfile);
                
                // Set onboarding status
                const onboardingComplete = newProfile?.onboarding_completed === true;
                setIsOnboardingComplete(onboardingComplete);
                console.log('AuthContext: New profile onboarding complete:', onboardingComplete);
              }
            } catch (createError) {
              console.error('AuthContext: Exception creating default profile:', createError);
            }
          } else {
            // Profile was found
            setProfile(userProfile);
            
            // Check onboarding status from profile
            const onboardingComplete = userProfile?.onboarding_completed === true;
            setIsOnboardingComplete(onboardingComplete);
            console.log('AuthContext: Onboarding complete:', onboardingComplete);
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
        console.log('AuthContext: Auth state changed:', event);
        if (session?.user) {
          console.log('AuthContext: User authenticated:', session.user.email, 'ID:', session.user.id);
          setUser(session.user);
          
          // For auth state changes, we need more reliable profile fetching with retries
          const userProfile = await fetchProfile(session.user.id, 0, 1000);
          console.log('AuthContext: User profile after auth state change:', userProfile ? 'found' : 'not found');
          
          if (!userProfile) {
            console.log('AuthContext: Profile not found after auth, attempting to create default one');
            // Create a default profile if none exists
            try {
              const email = session.user.email || 'user';
              const username = email.split('@')[0];
              
              const { error: createError } = await supabase
                .from('user_profiles')
                .insert([
                  { 
                    id: session.user.id,
                    username: username,
                    onboarding_completed: false,
                    notification_preferences: { enabled: false }
                  }
                ]);
                
              if (createError) {
                console.error('AuthContext: Error creating default profile after auth:', createError);
              } else {
                console.log('AuthContext: Created default profile after auth');
                // Fetch the newly created profile
                const newProfile = await fetchProfile(session.user.id);
                setProfile(newProfile);
                
                // Set onboarding status
                const onboardingComplete = newProfile?.onboarding_completed === true;
                setIsOnboardingComplete(onboardingComplete);
              }
            } catch (createError) {
              console.error('AuthContext: Exception creating default profile after auth:', createError);
            }
          } else {
            // Profile was found
            setProfile(userProfile);
            
            // Check onboarding status from profile
            const onboardingComplete = userProfile?.onboarding_completed === true;
            setIsOnboardingComplete(onboardingComplete);
            console.log('AuthContext: Onboarding complete after auth state change:', onboardingComplete);
          }
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

    return () => {
      console.log('AuthContext: Cleaning up auth listener');
      clearTimeout(loadingTimeout);
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Enhanced signIn function with more reliable profile fetching
  const signIn = (newUser: User) => {
    console.log('AuthContext: Manual sign in for user:', newUser.email, 'ID:', newUser.id);
    setUser(newUser);
    
    // Immediately set loading to true to prevent UI from rendering too early
    setLoading(true);
    
    // Fetch user profile with increased retries
    fetchProfile(newUser.id, 0, 1000).then(userProfile => {
      console.log('AuthContext: Profile fetched during manual sign in:', userProfile ? 'found' : 'not found');
      
      if (!userProfile) {
        console.log('AuthContext: No profile found during manual sign in, creating a default one');
        // Create default profile if none exists
        const email = newUser.email || 'user';
        const username = email.split('@')[0];
        
        // Use async/await in a self-executing function to handle errors cleanly
        (async () => {
          try {
            const { error } = await supabase
              .from('user_profiles')
              .insert([
                { 
                  id: newUser.id,
                  username: username,
                  onboarding_completed: false,
                  notification_preferences: { enabled: false }
                }
              ]);
              
            if (error) {
              console.error('AuthContext: Error creating default profile during manual sign in:', error);
              setLoading(false);
            } else {
              console.log('AuthContext: Created default profile during manual sign in');
              // Fetch the newly created profile
              const newProfile = await fetchProfile(newUser.id);
              setProfile(newProfile);
              const onboardingComplete = newProfile?.onboarding_completed === true;
              setIsOnboardingComplete(onboardingComplete);
              setLoading(false);
            }
          } catch (error: unknown) {
            console.error('AuthContext: Exception creating default profile during manual sign in:', error);
            setLoading(false);
          }
        })();
      } else {
        // Profile found, update state
        setProfile(userProfile);
        const onboardingComplete = userProfile?.onboarding_completed === true;
        setIsOnboardingComplete(onboardingComplete);
        setLoading(false);
        console.log('AuthContext: Onboarding complete after manual sign in:', onboardingComplete);
      }
    });
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Signing out user');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthContext: Error signing out:', error);
        throw error;
      }
      console.log('AuthContext: User signed out successfully');
      setUser(null);
      setProfile(null);
      setIsOnboardingComplete(null);
    } catch (error) {
      console.error('AuthContext: Error signing out:', error);
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
      // Check onboarding status from profile instead of metadata
      const userProfile = await fetchProfile(user.id);
      const onboardingComplete = userProfile?.onboarding_completed === true;
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
      // Fetch updated profile
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
      console.log('AuthContext: Updated profile:', updatedProfile);
      
      return { error: null };
    } catch (error: any) {
      console.error('AuthContext: Exception updating profile:', error);
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
      updateProfile
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