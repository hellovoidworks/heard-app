import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, SafeAreaView, Text as RNText, Animated } from 'react-native';
import { TextInput, Button, Text, Divider, ActivityIndicator, useTheme, Surface } from 'react-native-paper';
import CategorySelector from '../components/CategorySelector';
import LabeledTextInput from '../components/LabeledTextInput';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoryContext';
import { useFonts } from 'expo-font';
import { Inter_700Bold, Inter_500Medium } from '@expo-google-fonts/inter';

type WriteLetterDetailsParams = {
  title: string;
  content: string;
  moodEmoji: string;
  categoryId?: string;
  category?: any;
};



const WriteLetterDetailsScreen = () => {
  const { user, profile, updateStars } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriteLetterDetailsParams>, string>>();
  const theme = useTheme();
  const { categories, loading: loadingCategories, selectedCategory, setSelectedCategory } = useCategories();
  
  // Load Inter font
  const [fontsLoaded] = useFonts({
    Inter_700Bold,
    Inter_500Medium
  });
  
  // Required params from previous screen
  const generatedTitle = route.params?.title || ''; // This is auto-generated from content in first screen
  const content = route.params?.content || '';
  const moodEmoji = route.params?.moodEmoji || '';
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  // Always start with blank display name and subject to force user to enter them each time
  const [displayName, setDisplayName] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear selected category when screen loads
  useEffect(() => {
    // Clear any previously selected category
    setSelectedCategory(null);
    
    // Only set from route params if explicitly provided
    if (initialCategory && initialCategory.id) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory, setSelectedCategory]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a letter.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter content for your letter.');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category for your letter.');
      return;
    }

    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name.');
      return;
    }



    try {
      setIsSubmitting(true);

      // Create the letter in the database
      const { data, error } = await supabase
        .from('letters')
        .insert([
          {
            title: subjectTitle || generatedTitle,
            content,
            author_id: user.id,
            display_name: displayName.trim(),
            category_id: selectedCategory.id,
            mood_emoji: moodEmoji,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Award 5 stars for submitting a letter
      const { error: starError } = await updateStars(5);
      if (starError) {
        console.error('Error updating stars:', starError);
        // Don't block navigation if star update fails
      }

      // On success, navigate to the Main stack with Home tab
      navigation.navigate('Main');
    } catch (error: any) {
      console.error('Error submitting letter:', error.message);
      Alert.alert('Error', 'Failed to submit your letter. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    // Standard back navigation will be handled by the header back button
    navigation.goBack();
  };

  const handleCategorySelect = (category: any) => {
    setSelectedCategory(category);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.contentContainer}
        >
          <LabeledTextInput
            label="Subject"
            value={subjectTitle}
            onChangeText={setSubjectTitle}
            placeholder="Your subject header appears to the public"
            maxLength={100}
            layout="horizontal"
            labelWidth="22%"
            mode="flat"
            dense={true}
            multiline={true}
            numberOfLines={2}
            inputStyle={styles.titleInput}
            labelStyle={{ fontFamily: 'Inter_700Bold', fontSize: 16 }}
          />
          
          <View style={styles.divider} />
          
          <LabeledTextInput
            label="From"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter a name"
            maxLength={50}
            required={false}
            hint="This name will be shown publicly together with your mail"
            layout="horizontal"
            labelWidth="22%"
            mode="flat"
            dense={true}
            labelStyle={{ fontFamily: 'Inter_700Bold', fontSize: 16 }}
          />
          
          <View style={styles.divider} />
          
          <Text style={[styles.label, { color: theme.colors.onBackground, fontFamily: 'Inter_700Bold' }]}>Category</Text>
          <CategorySelector
            categories={categories}
            selectedCategories={selectedCategory ? [selectedCategory.id] : []}
            onSelectionChange={(selected: string[]) => {
              if (selected.length > 0) {
                const category = categories.find(c => c.id === selected[0]);
                if (category) handleCategorySelect(category);
              }
            }}
            loading={loadingCategories}
            selectionMode="single"
            horizontal={false}
            containerStyle={styles.categoriesContainer}
          />
        </ScrollView>
        
        <View style={[styles.buttonContainer, { 
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outline 
        }]}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            loading={isSubmitting}
            disabled={isSubmitting || !content.trim() || !selectedCategory || !displayName.trim()}
          >
            <Text style={{ 
              color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() 
                ? theme.colors.onSurfaceDisabled 
                : 'white'
            }}>
              Send Mail + 5{' '}
              <Text style={{ 
                color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() 
                  ? theme.colors.onSurfaceDisabled 
                  : '#FFD700',
                fontSize: 18
              }}>★</Text>
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  titleInput: {
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  labelContainer: {
    marginBottom: 0,
    marginTop: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  categoryChip: {
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
  },
  displayNameInput: {
    marginBottom: 8,
  },
  displayNameHint: {
    fontSize: 12,
    marginBottom: 24,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
    borderTopWidth: 1,
  },
  submitButton: {
    padding: 8,
  },
  loading: {
    marginVertical: 16,
  },
});

export default WriteLetterDetailsScreen; 