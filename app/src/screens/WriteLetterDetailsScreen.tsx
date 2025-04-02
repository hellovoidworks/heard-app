import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, SafeAreaView, Text as RNText } from 'react-native';
import { TextInput, Button, Text, Divider, ActivityIndicator, useTheme, Surface } from 'react-native-paper';
import CategorySelector from '../components/CategorySelector';
import LabeledTextInput from '../components/LabeledTextInput';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoryContext';

type WriteLetterDetailsParams = {
  title: string;
  content: string;
  categoryId?: string;
  category?: any;
};

// Mood options with emojis and labels
const MOOD_OPTIONS = [
  { emoji: '🥱', label: 'Bored' },
  { emoji: '👌', label: 'Okay' },
  { emoji: '😁', label: 'Happy' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '😈', label: 'Playful' },
  { emoji: '😟', label: 'Worried' },
  { emoji: '😪', label: 'Lonely' },
  { emoji: '😕', label: 'Confused' },
  { emoji: '😖', label: 'Stressed' },
  { emoji: '😢', label: 'Sad' },
];

const WriteLetterDetailsScreen = () => {
  const { user, profile, updateStars } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriteLetterDetailsParams>, string>>();
  const theme = useTheme();
  const { categories, loading: loadingCategories, selectedCategory, setSelectedCategory } = useCategories();
  
  // Required params from previous screen
  const title = route.params?.title || '';
  const content = route.params?.content || '';
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  // Always start with blank display name to force user to enter it each time
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moodEmoji, setMoodEmoji] = useState('');

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

    if (!moodEmoji) {
      Alert.alert('Error', 'Please select a mood for your letter.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create the letter in the database
      const { data, error } = await supabase
        .from('letters')
        .insert([
          {
            title,
            content,
            author_id: user.id,
            display_name: displayName.trim(),
            category_id: selectedCategory.id,
            mood_emoji: moodEmoji || null,
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

  const handleEmojiSelect = (emoji: string) => {
    // Select the emoji or deselect if already selected
    setMoodEmoji(emoji === moodEmoji ? '' : emoji);
  };

  // Create rows of 5 emojis each for the grid layout
  const moodRows = [];
  for (let i = 0; i < MOOD_OPTIONS.length; i += 5) {
    moodRows.push(MOOD_OPTIONS.slice(i, i + 5));
  }

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
          <Text style={[styles.label, { color: theme.colors.onBackground }]}>Select Your Mood</Text>
          
          <View style={styles.moodGrid}>
            {moodRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.moodRow}>
                {row.map((option) => (
                  <View key={option.label} style={styles.moodOptionContainer}>
                    <TouchableOpacity
                      style={[
                        styles.moodOption,
                        moodEmoji === option.emoji && [styles.selectedMoodOption, { borderColor: 'white' }]
                      ]}
                      onPress={() => handleEmojiSelect(option.emoji)}
                    >
                      <Text style={styles.emojiText}>{option.emoji}</Text>
                    </TouchableOpacity>
                    <RNText style={[styles.moodLabel, { color: theme.colors.onSurface }]}>
                      {option.label}
                    </RNText>
                  </View>
                ))}
              </View>
            ))}
          </View>
          
          <Text style={[styles.label, { color: theme.colors.onBackground }]}>Category</Text>
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
          
          <LabeledTextInput
            label="From"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter a name"
            maxLength={50}
            required={false}
            hint="This name will be shown publicly together with your letter"
            layout="horizontal"
            labelWidth="22%"
            mode="flat"
            dense={true}
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
            disabled={isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji}
          >
            <Text style={{ 
              color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji 
                ? theme.colors.onSurfaceDisabled 
                : 'white'
            }}>
              Send Mail + 5{' '}
              <Text style={{ 
                color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji 
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
  moodGrid: {
    marginBottom: 24,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moodOptionContainer: {
    alignItems: 'center',
    width: '20%', // 5 items per row = 20% each
  },
  moodOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedMoodOption: {
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 24,
  },
  moodLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 16,
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