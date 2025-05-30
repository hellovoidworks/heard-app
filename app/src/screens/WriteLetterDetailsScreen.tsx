import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, SafeAreaView, Text as RNText, Animated } from 'react-native';
import { Adjust, AdjustEvent } from 'react-native-adjust';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextInput, Button, Text, Divider, ActivityIndicator, useTheme, Surface } from 'react-native-paper';
import CategorySelector from '../components/CategorySelector';
import LabeledTextInput from '../components/LabeledTextInput';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoryContext';
import { useFonts, Inter_700Bold } from '@expo-google-fonts/inter';
import eventEmitter, { EVENTS } from '../utils/eventEmitter';

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
  const { categories, loading: loadingCategories, selectedCategory, setSelectedCategory, refreshCategories } = useCategories();
  
  // Load Inter font
  const [fontsLoaded] = useFonts({
    Inter_700Bold
  });
  
  // Required params from previous screen
  const title = route.params?.title || '';
  const content = route.params?.content || '';
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  // Always start with blank display name to force user to enter it each time
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moodEmoji, setMoodEmoji] = useState('');

  // Ensure categories are loaded when the screen mounts, but only if they're not already available
  useEffect(() => {
    // Only refresh categories if the list is empty and we're not already loading
    if (categories.length === 0 && !loadingCategories) {
      refreshCategories();
    }
  }, [categories.length, loadingCategories, refreshCategories]);
  
  // Handle selected category initialization
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
      console.log('WriteLetterDetailsScreen: About to update stars for sending letter');
      const { error: starError } = await updateStars(5);
      if (starError) {
        console.error('Error updating stars:', starError);
        // Don't block navigation if star update fails
      }
      
      // Note: We no longer need to store the pending reward in AsyncStorage
      // because the STAR_REWARD_EARNED event is now emitted directly in AuthContext

      // Track the Sent Mail event with Adjust
      const adjustEvent = new AdjustEvent('40ccjt');
      Adjust.trackEvent(adjustEvent);

      // Navigate immediately - the animation will be shown after navigation
      console.log('WriteLetterDetailsScreen: Navigating to Home screen');
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

  const emojiScaleAnims = useRef<{[key: string]: Animated.Value}>({}).current;
  
  // Initialize animation values for each emoji
  useEffect(() => {
    MOOD_OPTIONS.forEach(option => {
      if (!emojiScaleAnims[option.emoji]) {
        emojiScaleAnims[option.emoji] = new Animated.Value(1);
      }
    });
  }, []);

  const handleEmojiSelect = (emoji: string) => {
    // Animate the selected emoji
    if (emoji !== moodEmoji) {
      // First reset any previously selected emoji
      if (moodEmoji && emojiScaleAnims[moodEmoji]) {
        Animated.timing(emojiScaleAnims[moodEmoji], {
          toValue: 1,
          duration: 150,
          useNativeDriver: true
        }).start();
      }
      
      // Then animate the newly selected emoji
      if (emojiScaleAnims[emoji]) {
        // Create a sequence of animations: scale up, then down
        Animated.sequence([
          Animated.timing(emojiScaleAnims[emoji], {
            toValue: 1.3,
            duration: 150,
            useNativeDriver: true
          }),
          Animated.timing(emojiScaleAnims[emoji], {
            toValue: 1,
            duration: 100,
            useNativeDriver: true
          })
        ]).start();
      }
    }
    
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
          <Text style={[styles.label, { color: theme.colors.onBackground, fontFamily: 'Inter_700Bold', fontSize: 16 }]}>Your Mood</Text>
          
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
                      <Animated.Text 
                        style={[
                          styles.emojiText,
                          { transform: [{ scale: emojiScaleAnims[option.emoji] || new Animated.Value(1) }] }
                        ]}
                      >
                        {option.emoji}
                      </Animated.Text>
                    </TouchableOpacity>
                    <RNText style={[styles.moodLabel, { color: theme.colors.onSurface }]}>
                      {option.label}
                    </RNText>
                  </View>
                ))}
              </View>
            ))}
          </View>
          
          <Text style={[styles.label, { color: theme.colors.onBackground, fontFamily: 'Inter_700Bold', fontSize: 16 }]}>Select Category</Text>
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
            placeholder="Enter an anonymous name"
            maxLength={50}
            required={false}
            hint="This name will be shown with your mail"
            layout="horizontal"
            labelWidth="22%"
            mode="flat"
            dense={true}
            labelStyle={{ fontFamily: 'Inter_700Bold', fontSize: 16 }}
          />
        </ScrollView>
        
        <View style={[styles.buttonContainer, { 
          backgroundColor: theme.colors.background,
          borderTopWidth: 0
        }]}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            loading={isSubmitting}
            disabled={isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ 
                color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji 
                  ? theme.colors.onSurfaceDisabled 
                  : 'white'
              }}>
                Send Mail + 5
              </Text>
              <Text style={{ 
                color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji 
                  ? theme.colors.onSurfaceDisabled 
                  : '#FFD700',
                fontSize: 18,
                marginTop: 1,
                marginLeft: 0
              }}>★</Text>
            </View>
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
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
  },
  submitButton: {
    padding: 8,
  },
  loading: {
    marginVertical: 16,
  },
});

export default WriteLetterDetailsScreen; 