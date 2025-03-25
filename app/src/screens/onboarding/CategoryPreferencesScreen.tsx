import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList, SafeAreaView } from 'react-native';
import { Button, Text, Title, Chip, ActivityIndicator, IconButton, useTheme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontNames } from '../../utils/fonts';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CategoryPreferences'>;

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
}

const CategoryPreferencesScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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

  const renderCategoryItem = ({ item }: { item: Category }) => {
    // Create a lighter version of the category color for the border
    const color = item.color || theme.colors.primary;
    const isSelected = selectedCategories.includes(item.id);
    
    return (
      <Chip
        selected={isSelected}
        onPress={() => toggleCategory(item.id)}
        selectedColor="#FFFFFF"
        showSelectedCheck={false}
        textStyle={{ 
          color: isSelected ? '#FFFFFF' : theme.colors.onSurface,
          fontFamily: fontNames.sourceCodeProSemiBold,
          textTransform: 'uppercase',
          fontSize: 14
        }}
        mode={isSelected ? 'flat' : 'outlined'}
        style={[
          styles.chip,
          isSelected 
            ? { backgroundColor: color } 
            : { borderColor: color + '80' } // Add 50% transparency to the color
        ]}
      >
        {item.name.toUpperCase()}
      </Chip>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { marginTop: insets.top > 0 ? 0 : 16 }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={handleGoBack}
          iconColor={theme.colors.onBackground}
        />
        <Title style={[styles.title, { color: theme.colors.onBackground, fontSize: 28, fontWeight: 'bold' }]}>Select Your Interests</Title>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom }
        ]}
      >
        <Text style={[styles.description, { color: theme.colors.onBackground }]}>
          Choose at least 3 categories that interest you. We'll use these to personalize your experience.
        </Text>
        
        <View style={styles.categoriesContainer}>
          {categories.map(category => {
            // Create a lighter version of the category color for the border
            const color = category.color || theme.colors.primary;
            const isSelected = selectedCategories.includes(category.id);
            
            return (
              <Chip
                key={category.id}
                selected={isSelected}
                onPress={() => toggleCategory(category.id)}
                selectedColor="#FFFFFF"
                showSelectedCheck={false}
                textStyle={{ 
                  color: isSelected ? '#FFFFFF' : theme.colors.onSurface,
                  fontFamily: fontNames.sourceCodeProSemiBold,
                  textTransform: 'uppercase',
                  fontSize: 14
                }}
                mode={isSelected ? 'flat' : 'outlined'}
                style={[
                  styles.chip,
                  isSelected 
                    ? { backgroundColor: color } 
                    : { borderColor: color + '80' } // Add 50% transparency to the color
                ]}
              >
                {category.name.toUpperCase()}
              </Chip>
            );
          })}
        </View>
        
        <Text style={[styles.selectionCount, { color: theme.colors.onSurfaceVariant }]}>
          {selectedCategories.length} of {categories.length} selected
          {selectedCategories.length < 3 && ' (minimum 3)'}
        </Text>
      </ScrollView>
      
      <View style={[
        styles.footer, 
        { 
          backgroundColor: theme.colors.background, 
          paddingBottom: Math.max(insets.bottom, 20)
        }
      ]}>
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          loading={saving}
          disabled={saving || selectedCategories.length < 3}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          labelStyle={{ fontSize: 18, fontWeight: 'bold' }}
        >
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
    borderRadius: 20,
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
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    paddingVertical: 6,
    borderRadius: 28,
  },
});

export default CategoryPreferencesScreen; 