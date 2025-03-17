import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { Button, Text, Title, HelperText } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AgeVerification'>;

const AgeVerificationScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date(2000, 0, 1)); // Default to January 1, 2000
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOver18, setIsOver18] = useState(true); // Default to true for initial date (2000)

  // Log navigation state for debugging
  useEffect(() => {
    console.log('AgeVerificationScreen mounted');
    return () => {
      console.log('AgeVerificationScreen unmounted');
    };
  }, []);

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
    
    try {
      // Store the birthdate in user metadata
      if (user) {
        console.log('Updating user metadata with birthdate...');
        const formattedDate = format(date, 'MM/dd/yyyy');
        
        // First, get the current user metadata to avoid overwriting existing data
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user data:', userError);
          throw userError;
        }
        
        // Merge existing metadata with new data
        const currentMetadata = userData.user?.user_metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          birthdate: formattedDate,
          onboarding_completed: false,
          onboarding_step: 'age_verified'
        };
        
        console.log('Updating with metadata:', updatedMetadata);
        
        const { data, error } = await supabase.auth.updateUser({
          data: updatedMetadata
        });
        
        if (error) {
          console.error('Error updating user metadata:', error);
          throw error;
        }
        
        console.log('User metadata updated successfully:', data);
        
        // Force a small delay to ensure state updates are processed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('Navigating to CategoryPreferences screen...');
        
        // Use the replace method instead of navigate to avoid navigation stack issues
        navigation.replace('CategoryPreferences');
      } else {
        console.error('No user found in context');
        Alert.alert('Error', 'User not found. Please try signing in again.');
      }
    } catch (error: any) {
      console.error('Error in handleContinue:', error);
      Alert.alert('Error', error.message || 'An error occurred while saving your birthdate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Title style={styles.title}>Verify Your Age</Title>
        
        <Text style={styles.description}>
          To use Heard, you must be at least 18 years old. Please select your date of birth.
        </Text>
        
        {Platform.OS === 'android' && (
          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={showDatepicker}
            disabled={loading}
          >
            <Text style={styles.dateButtonText}>
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
          />
        )}
        
        {error ? <HelperText type="error">{error}</HelperText> : null}
        
        <Button
          mode="contained"
          onPress={handleContinue}
          style={[styles.button, !isOver18 && styles.disabledButton]}
          loading={loading}
          disabled={loading || !isOver18}
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
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    fontSize: 24,
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
    borderColor: '#ccc',
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
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default AgeVerificationScreen; 