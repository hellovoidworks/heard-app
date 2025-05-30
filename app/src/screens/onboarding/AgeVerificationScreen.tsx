import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { Adjust, AdjustEvent } from 'react-native-adjust';
import { Button, Text, Title, HelperText, useTheme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePreload } from '../../contexts/PreloadContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AgeVerification'>;

const AgeVerificationScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const { setPreloadedCategories } = usePreload();
  const [date, setDate] = useState(new Date(2000, 0, 1)); // Default to January 1, 2000
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOver18, setIsOver18] = useState(true); // Default to true for initial date (2000)
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const theme = useTheme();

  // Reset loading state when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('AgeVerificationScreen focused, resetting loading state');
      setLoading(false);
      return () => {};
    }, [])
  );

  // Log navigation state for debugging
  useEffect(() => {
    console.log('AgeVerificationScreen mounted');
    
    // Track the Age Verification Appear event
    const adjustEvent = new AdjustEvent('ncsa2y');
    Adjust.trackEvent(adjustEvent);
    
    // Preload categories when the screen mounts
    preloadCategories();
    return () => {
      console.log('AgeVerificationScreen unmounted');
    };
  }, []);
  
  // Preload categories to improve user experience
  const preloadCategories = async () => {
    if (categoriesLoading) return;
    
    setCategoriesLoading(true);
    console.log('Preloading categories for better user experience...');
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error preloading categories:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log(`Successfully preloaded ${data.length} categories`);
        setPreloadedCategories(data);
      } else {
        console.warn('No categories found during preloading');
      }
    } catch (error) {
      console.error('Exception in preloadCategories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const validateAge = (selectedDate: Date) => {
    // Calculate age
    const today = new Date();
    let age = today.getFullYear() - selectedDate.getFullYear();
    const monthDiff = today.getMonth() - selectedDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < selectedDate.getDate())) {
      age--;
    }
    
    // Check if user is at least 18
    if (age < 18) {
      setError('You must be at least 18 years old to use this app');
      setIsOver18(false);
      return false;
    }
    
    // Check if date is in the future
    if (selectedDate > today) {
      setError('Please enter a valid birth date');
      setIsOver18(false);
      return false;
    }
    
    setError('');
    setIsOver18(true);
    return true;
  };

  // Validate initial date
  useEffect(() => {
    validateAge(date);
  }, []);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      setDate(selectedDate);
      validateAge(selectedDate);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const handleContinue = async () => {
    if (!validateAge(date)) {
      return;
    }

    setLoading(true);
    console.log('Starting handleContinue function...');
    
    try {
      // Store the birthdate and onboarding progress in user_profiles table instead of metadata
      if (user) {
        console.log('User found:', user.id);
        console.log('Saving birthdate and onboarding progress to user_profiles table...');
        const formattedDate = format(date, 'MM/dd/yyyy');
        
        // Update the user_profiles table with the birthdate and onboarding step
        console.log('Making Supabase request to update user_profiles...');
        const profileUpdateResult = await supabase
          .from('user_profiles')
          .update({
            birthdate: formattedDate,
            onboarding_step: 'age_verified',
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        console.log('Profile update result:', JSON.stringify(profileUpdateResult));
        
        if (profileUpdateResult.error) {
          console.error('Error updating user profile:', profileUpdateResult.error);
          throw profileUpdateResult.error;
        }
        
        console.log('User profile updated successfully with birthdate and onboarding progress');
        
        // Skip updating user metadata to avoid SecureStore size limit issues
        console.log('Skipping user metadata update to avoid SecureStore size limit issues');
        
        // Force a small delay to ensure state updates are processed
        console.log('Waiting before navigation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Attempting to navigate to CategoryPreferences screen...');
        
        try {
          // Use the navigate method instead of replace
          navigation.navigate('CategoryPreferences');
          console.log('Navigation.navigate called successfully');
        } catch (navError) {
          console.error('Navigation error:', navError);
          Alert.alert('Navigation Error', 'Failed to navigate to the next screen. Please try again.');
        }
        
        // If we're still here after 2 seconds, something went wrong with navigation
        setTimeout(() => {
          if (loading) {
            console.log('Still on AgeVerificationScreen after 2 seconds, forcing loading state to false');
            setLoading(false);
            Alert.alert(
              'Navigation Issue', 
              'There seems to be a problem navigating to the next screen. Please try again or restart the app.'
            );
          }
        }, 2000);
      } else {
        console.error('No user found in context');
        Alert.alert('Error', 'User not found. Please try signing in again.');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error in handleContinue:', error);
      Alert.alert('Error', error.message || 'An error occurred while saving your birthdate');
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={[
        styles.container, 
        { backgroundColor: theme.colors.background }
      ]}
    >
      <View style={styles.content}>
        <Title style={[styles.title, { color: theme.colors.onBackground, fontSize: 28, fontWeight: 'bold' }]}>Verify Your Age</Title>
        
        <Text style={[styles.description, { color: theme.colors.onBackground }]}>
          To use Heard, you must be at least 18 years old. Please select your date of birth.
        </Text>
        
        {Platform.OS === 'android' && (
          <TouchableOpacity 
            style={[styles.dateButton, { borderColor: theme.colors.outline }]} 
            onPress={showDatepicker}
            disabled={loading}
          >
            <Text style={[styles.dateButtonText, { color: theme.colors.onBackground }]}>
              {format(date, 'MMMM d, yyyy')}
            </Text>
          </TouchableOpacity>
        )}
        
        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            style={styles.datePicker}
            textColor={Platform.OS === 'ios' ? theme.colors.onBackground : undefined}
          />
        )}
        
        {error ? <HelperText type="error" style={{ color: theme.colors.error }}>{error}</HelperText> : null}
        
        <Button
          mode="contained"
          onPress={handleContinue}
          style={[styles.button, !isOver18 && styles.disabledButton]}
          loading={loading}
          disabled={loading || !isOver18}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          labelStyle={{ fontSize: 18, fontWeight: 'bold' }}
        >
          Continue
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 16,
    lineHeight: 24,
  },
  datePicker: {
    width: Platform.OS === 'ios' ? '100%' : 'auto',
    marginBottom: 20,
  },
  dateButton: {
    width: '100%',
    padding: 15,
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
  },
  button: {
    width: '100%',
    marginTop: 20,
    paddingVertical: 6,
    borderRadius: 28,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default AgeVerificationScreen; 