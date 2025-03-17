import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { Button, Text, Title, Chip, ActivityIndicator, IconButton } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CategoryPreferences'>;

interface Category {
  id: string;
  name: string;
  description: string;
}

const CategoryPreferencesScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add logging for debugging
  useEffect(() => {
    console.log('CategoryPreferencesScreen mounted');
    console.log('User from context:', user?.id);
    return () => {
      console.log('CategoryPreferencesScreen unmounted');
    };
  }, [user]);

  useEffect(() => {
    console.log('Fetching categories...');
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      console.log('Making Supabase request for categories');
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
      
      if (data) {
        console.log(`Received ${data.length} categories:`, JSON.stringify(data));
        if (data.length === 0) {
          console.warn('No categories found in the database');
          Alert.alert(
            'No Categories Found', 
            'There are no categories available. Please contact support or try again later.'
          );
        }
        setCategories(data);
      } else {
        console.warn('No data returned from categories query');
      }
    } catch (error: any) {
      console.error('Exception in fetchCategories:', error);
      Alert.alert('Error', error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleContinue = async () => {
    if (selectedCategories.length < 3) {
      Alert.alert('Please select at least 3 categories');
      return;
    }

    setSaving(true);
    console.log('Starting handleContinue in CategoryPreferencesScreen...');
    
    try {
      if (user) {
        console.log('User found:', user.id);
        
        // Save user preferences
        console.log('Saving user category preferences...');
        const promises = selectedCategories.map(categoryId => 
          supabase
            .from('user_category_preferences')
            .insert({
              user_id: user.id,
              category_id: categoryId
            })
        );
        
        await Promise.all(promises);
        console.log('User category preferences saved successfully');
        
        // Update onboarding progress in user_profiles table
        console.log('Updating onboarding progress in user_profiles table...');
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            onboarding_step: 'categories_completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (profileError) {
          console.error('Error updating user profile:', profileError);
          throw profileError;
        }
        
        console.log('User profile updated with onboarding progress');
        
        // Navigate to the next onboarding screen
        console.log('Navigating to NotificationPermission screen...');
        navigation.navigate('NotificationPermission');
      } else {
        console.error('No user found in context');
        Alert.alert('Error', 'User not found. Please try signing in again.');
      }
    } catch (error: any) {
      console.error('Error in handleContinue:', error);
      Alert.alert('Error', error.message || 'Failed to save your preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <Chip
      selected={selectedCategories.includes(item.id)}
      onPress={() => toggleCategory(item.id)}
      style={styles.chip}
      selectedColor="#6200ee"
      mode={selectedCategories.includes(item.id) ? 'flat' : 'outlined'}
    >
      {item.name}
    </Chip>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={handleGoBack}
        />
        <Title style={styles.title}>Select Your Interests</Title>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          Choose at least 3 categories that interest you. We'll use these to personalize your experience.
        </Text>
        
        <View style={styles.categoriesContainer}>
          {categories.map(category => (
            <Chip
              key={category.id}
              selected={selectedCategories.includes(category.id)}
              onPress={() => toggleCategory(category.id)}
              style={styles.chip}
              selectedColor="#6200ee"
              mode={selectedCategories.includes(category.id) ? 'flat' : 'outlined'}
            >
              {category.name}
            </Chip>
          ))}
        </View>
        
        <Text style={styles.selectionCount}>
          {selectedCategories.length} of {categories.length} selected
          {selectedCategories.length < 3 && ' (minimum 3)'}
        </Text>
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          loading={saving}
          disabled={saving || selectedCategories.length < 3}
        >
          Continue
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 16,
    lineHeight: 24,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  chip: {
    margin: 5,
  },
  selectionCount: {
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    width: '100%',
    paddingVertical: 6,
  },
});

export default CategoryPreferencesScreen; 