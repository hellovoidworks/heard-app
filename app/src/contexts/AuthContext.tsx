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
          console.error('AuthContext: Error checking session:', error);
          setLoading(false); // Ensure loading is set to false even on error
          throw error;
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
                
                // Create profile with default values
                const email = data.session.user.email || 'user';
                const username = email.split('@')[0];
                
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
        console.log('AuthContext: Auth state changed:', event);
        
        if (session?.user) {
          console.log('AuthContext: User authenticated:', session.user.email, 'ID:', session.user.id);
          setUser(session.user);
          
          try {
            // Fetch user profile directly without retries
            console.log('AuthContext: Fetching profile after auth state change');
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileError) {
              console.error('AuthContext: Error fetching profile after auth state change:', profileError);
              
              // If no profile found, create one immediately
              if (profileError.code === 'PGRST116') {
                console.log('AuthContext: No profile found after auth state change, creating one');
                
                // Create profile with default values
                const email = session.user.email || 'user';
                const username = email.split('@')[0];
                
                const { error: createError } = await supabase
                  .from('user_profiles')
                  .insert([{
                    id: session.user.id,
                    username,
                    onboarding_completed: false,
                    notification_preferences: { enabled: false }
                  }]);
                
                if (createError) {
                  console.error('AuthContext: Error creating profile after auth state change:', createError);
                  setLoading(false);
                  return;
                }
                
                // Fetch the newly created profile
                const { data: newProfile, error: fetchNewError } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                
                if (fetchNewError) {
                  console.error('AuthContext: Error fetching newly created profile after auth state change:', fetchNewError);
                  setLoading(false);
                  return;
                }
                
                // Set profile and onboarding status
                setProfile(newProfile);
                setIsOnboardingComplete(newProfile?.onboarding_completed === true);
                console.log('AuthContext: Created and set profile after auth state change');
              } else {
                setLoading(false);
                return;
              }
            } else {
              // Profile found, set it
              console.log('AuthContext: Profile found after auth state change:', profileData?.username);
              setProfile(profileData);
              setIsOnboardingComplete(profileData?.onboarding_completed === true);
            }
          } catch (e) {
            console.error('AuthContext: Exception during profile fetch after auth state change:', e);
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
          
          // Create profile with default values
          const email = newUser.email || 'user';
          const username = email.split('@')[0];
          
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