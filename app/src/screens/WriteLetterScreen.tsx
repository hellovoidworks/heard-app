import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Headline, Subheading, Divider, ActivityIndicator, Chip, useTheme, Surface } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

type WriterLetterParams = {
  categoryId?: string;
  parentId?: string;
  threadId?: string;
  category?: any;
};

// Common emoji moods that users can select quickly
const SUGGESTED_MOODS = ['😊', '😔', '😡', '😢', '😂', '😍', '🤔', '😴', '😎', '😒'];

const WriteLetterScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriterLetterParams>, string>>();
  const theme = useTheme();
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [categories, setCategories] = useState<any[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [moodEmoji, setMoodEmoji] = useState('');
  const [showEmojiSuggestions, setShowEmojiSuggestions] = useState(false);

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      if (data) {
        setCategories(data);
      }
    } catch (error: any) {
      console.error('Error fetching categories:', error.message);
      Alert.alert('Error', 'Failed to load categories. Please try again.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a letter.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your letter.');
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

    try {
      setIsSubmitting(true);

      // Create the letter in the database
      const { data, error } = await supabase
        .from('letters')
        .insert([
          {
            title,
            content,
            user_id: user.id,
            category_id: selectedCategory.id,
            is_anonymous: isAnonymous,
            mood_emoji: moodEmoji || null, // Include the mood emoji
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success',
        'Your letter has been submitted successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Home'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting letter:', error.message);
      Alert.alert('Error', 'Failed to submit your letter. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySelect = (category: any) => {
    setSelectedCategory(category);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMoodEmoji(emoji);
    setShowEmojiSuggestions(false);
  };

  // Function to validate if a string is a single emoji
  const validateEmoji = (text: string) => {
    // Basic validation to ensure it's just one emoji character
    // This isn't perfect but will work for most common emojis
    if (text.length > 2) {
      return false;
    }
    
    // More comprehensive validation could be added here if needed
    return true;
  };

  const handleEmojiInputChange = (text: string) => {
    if (text === '') {
      setMoodEmoji('');
      return;
    }
    
    if (validateEmoji(text)) {
      setMoodEmoji(text);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Headline style={styles.headline}>Write a Letter</Headline>
        <Subheading style={styles.subheading}>Share your thoughts with the community</Subheading>
        
        <Divider style={styles.divider} />

        <View style={styles.moodContainer}>
          <Text style={styles.label}>Your Mood</Text>
          <View style={styles.moodInputRow}>
            <TextInput
              value={moodEmoji}
              onChangeText={handleEmojiInputChange}
              placeholder="Add an emoji"
              style={styles.moodInput}
              maxLength={2}
              onFocus={() => setShowEmojiSuggestions(true)}
            />
            <TouchableOpacity 
              style={styles.moodHelpButton}
              onPress={() => setShowEmojiSuggestions(!showEmojiSuggestions)}
            >
              <Text>{showEmojiSuggestions ? 'Hide' : 'Suggestions'}</Text>
            </TouchableOpacity>
          </View>
          
          {showEmojiSuggestions && (
            <Surface style={styles.emojiSuggestions}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SUGGESTED_MOODS.map((emoji, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.emojiOption}
                    onPress={() => handleEmojiSelect(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Surface>
          )}
        </View>
        
        <Text style={styles.label}>Category</Text>
        {loadingCategories ? (
          <ActivityIndicator animating={true} style={styles.loading} />
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
          >
            {categories.map((category) => (
              <Chip
                key={category.id}
                selected={selectedCategory?.id === category.id}
                onPress={() => handleCategorySelect(category)}
                style={[
                  styles.categoryChip,
                  selectedCategory?.id === category.id && { backgroundColor: theme.colors.primary }
                ]}
                textStyle={[
                  styles.categoryChipText,
                  selectedCategory?.id === category.id && { color: '#fff' }
                ]}
              >
                {category.name}
              </Chip>
            ))}
          </ScrollView>
        )}
        
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter a title for your letter"
          style={styles.titleInput}
          maxLength={100}
        />
        
        <Text style={styles.label}>Content</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Write your letter here..."
          multiline
          numberOfLines={10}
          style={styles.contentInput}
          maxLength={5000}
        />
        
        <View style={styles.anonymousContainer}>
          <Button
            mode={isAnonymous ? "contained" : "outlined"}
            onPress={() => setIsAnonymous(!isAnonymous)}
            style={styles.anonymousButton}
          >
            {isAnonymous ? "Anonymous" : "Post with Name"}
          </Button>
          <Text style={styles.anonymousText}>
            {isAnonymous 
              ? "Your letter will be posted anonymously" 
              : "Your display name will be shown"}
          </Text>
        </View>
        
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={isSubmitting || !title.trim() || !content.trim() || !selectedCategory}
          loading={isSubmitting}
        >
          Submit Letter
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subheading: {
    color: '#666',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  moodContainer: {
    marginBottom: 16,
  },
  moodInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodInput: {
    flex: 1,
    fontSize: 24,
    textAlign: 'center',
    marginRight: 8,
  },
  moodHelpButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  emojiSuggestions: {
    flexDirection: 'row',
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    elevation: 2,
  },
  emojiOption: {
    padding: 8,
    marginHorizontal: 4,
  },
  emojiText: {
    fontSize: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryChip: {
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
  },
  titleInput: {
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  contentInput: {
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 200,
  },
  anonymousContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 24,
  },
  anonymousButton: {
    marginBottom: 8,
  },
  anonymousText: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    padding: 8,
  },
  loading: {
    marginVertical: 16,
  },
});

export default WriteLetterScreen; 