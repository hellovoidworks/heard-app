import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Title, ActivityIndicator, Appbar, useTheme } from 'react-native-paper';
import CategorySelector, { Category } from '../components/CategorySelector';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

// Using the Category interface imported from CategorySelector

const CategoryPreferencesSettingsScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const theme = useTheme();
  
  // Fetch both categories and user preferences
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchCategories(),
          fetchUserPreferences()
        ]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching categories:', error);
        Alert.alert('Error', 'Failed to load categories');
        return;
      }
      
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Exception in fetchCategories:', error);
    }
  };
  
  const fetchUserPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_category_preferences')
        .select('category_id')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching user preferences:', error);
        Alert.alert('Error', 'Failed to load your preferences');
        return;
      }
      
      if (data) {
        const userCategoryIds = data.map(item => item.category_id);
        setSelectedCategories(userCategoryIds);
        console.log(`Loaded ${userCategoryIds.length} user category preferences`);
      }
    } catch (error) {
      console.error('Exception in fetchUserPreferences:', error);
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
  
  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save preferences');
      return;
    }
    
    if (selectedCategories.length < 3) {
      Alert.alert('Error', 'Please select at least 3 categories');
      return;
    }
    
    setSaving(true);
    
    try {
      // First, remove all existing preferences
      const { error: deleteError } = await supabase
        .from('user_category_preferences')
        .delete()
        .eq('user_id', user.id);
      
      if (deleteError) {
        console.error('Error deleting existing preferences:', deleteError);
        throw deleteError;
      }
      
      // Then insert new preferences
      const promises = selectedCategories.map(categoryId => 
        supabase
          .from('user_category_preferences')
          .insert({
            user_id: user.id,
            category_id: categoryId
          })
      );
      
      await Promise.all(promises);
      
      Alert.alert(
        'Success', 
        'Your category preferences have been updated',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', error.message || 'Failed to save your preferences');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Category Preferences" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Category Preferences" />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.description, { color: theme.colors.onSurface }]}>
          Select categories that interest you. We'll use these to personalize your letters.
        </Text>
        
        <CategorySelector
          categories={categories}
          selectedCategories={selectedCategories}
          onSelectionChange={setSelectedCategories}
          selectionMode="multiple"
          minRequired={3}
          showSelectionCount={true}
          containerStyle={styles.categoriesContainer}
        />
        
        <Text style={[styles.selectionCount, { color: theme.colors.onSurfaceVariant }]}>
          {selectedCategories.length} of {categories.length} selected
          {selectedCategories.length < 3 && ' (minimum 3)'}
        </Text>
        
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          loading={saving}
          disabled={saving || selectedCategories.length < 3}
        >
          Save Preferences
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 24,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  chip: {
    margin: 4,
  },
  selectionCount: {
    marginVertical: 16,
    fontStyle: 'italic',
  },
  saveButton: {
    marginTop: 20,
    paddingVertical: 8,
  },
});

export default CategoryPreferencesSettingsScreen; 