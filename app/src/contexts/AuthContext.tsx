import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  isOnboardingComplete: boolean | null;
  checkOnboardingStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);

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
          
          // Check onboarding status
          const onboardingComplete = data.session.user.user_metadata?.onboarding_completed === true;
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
          
          // Check onboarding status
          const onboardingComplete = session.user.user_metadata?.onboarding_completed === true;
          setIsOnboardingComplete(onboardingComplete);
        } else {
          console.log('AuthContext: No user session');
          setUser(null);
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
    
    // Check onboarding status
    const onboardingComplete = newUser.user_metadata?.onboarding_completed === true;
    setIsOnboardingComplete(onboardingComplete);
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
      setIsOnboardingComplete(null);
    } catch (error) {
      console.error('AuthContext: Error signing out:', error);
      throw error;
    }
  };

  const checkOnboardingStatus = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data } = await supabase.auth.getUser();
      const onboardingComplete = data?.user?.user_metadata?.onboarding_completed === true;
      setIsOnboardingComplete(onboardingComplete);
      return onboardingComplete;
    } catch (error) {
      console.error('AuthContext: Error checking onboarding status:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signOut, 
      isOnboardingComplete,
      checkOnboardingStatus
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