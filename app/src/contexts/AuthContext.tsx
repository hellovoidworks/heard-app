import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

// Define the profile interface
interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
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
  avatar_url?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);

  // Fetch user profile from Supabase
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Exception fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check for active session on mount
    const checkSession = async () => {
      try {
        console.log('AuthContext: Checking for active session');
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('AuthContext: Error checking session:', error);
          throw error;
        }
        
        if (data?.session?.user) {
          console.log('AuthContext: Active session found for user:', data.session.user.email);
          setUser(data.session.user);
          
          // Fetch user profile
          const userProfile = await fetchProfile(data.session.user.id);
          setProfile(userProfile);
          
          // Check onboarding status from profile instead of metadata
          const onboardingComplete = userProfile?.onboarding_completed === true;
          setIsOnboardingComplete(onboardingComplete);
        } else {
          console.log('AuthContext: No active session found');
          setIsOnboardingComplete(null);
        }
      } catch (error) {
        console.error('AuthContext: Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state changed:', event);
        if (session?.user) {
          console.log('AuthContext: User authenticated:', session.user.email);
          setUser(session.user);
          
          // Fetch user profile
          const userProfile = await fetchProfile(session.user.id);
          setProfile(userProfile);
          
          // Check onboarding status from profile instead of metadata
          const onboardingComplete = userProfile?.onboarding_completed === true;
          setIsOnboardingComplete(onboardingComplete);
        } else {
          console.log('AuthContext: No user session');
          setUser(null);
          setProfile(null);
          setIsOnboardingComplete(null);
        }
        setLoading(false);
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = (newUser: User) => {
    console.log('AuthContext: Manual sign in for user:', newUser.email);
    setUser(newUser);
    
    // Fetch user profile
    fetchProfile(newUser.id).then(userProfile => {
      setProfile(userProfile);
      
      // Check onboarding status from profile instead of metadata
      const onboardingComplete = userProfile?.onboarding_completed === true;
      setIsOnboardingComplete(onboardingComplete);
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
    if (!user) return false;
    
    try {
      // Check onboarding status from profile instead of metadata
      const userProfile = await fetchProfile(user.id);
      const onboardingComplete = userProfile?.onboarding_completed === true;
      setIsOnboardingComplete(onboardingComplete);
      return onboardingComplete;
    } catch (error) {
      console.error('AuthContext: Error checking onboarding status:', error);
      return false;
    }
  };

  const updateProfile = async (params: UpdateProfileParams): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      console.log('AuthContext: Updating profile for user:', user.id);
      
      // With the database trigger, we can assume the profile always exists
      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: params.username,
          avatar_url: params.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        console.error('AuthContext: Error updating profile:', error);
        return { error: new Error(error.message) };
      }
      
      // Fetch updated profile
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
      
      return { error: null };
    } catch (error: any) {
      console.error('AuthContext: Exception updating profile:', error);
      return { error };
    }
  };

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