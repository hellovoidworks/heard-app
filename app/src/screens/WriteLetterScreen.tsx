import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Headline, Subheading, Divider, ActivityIndicator, Chip, useTheme, Surface } from 'react-native-paper';
import LabeledTextInput from '../components/LabeledTextInput';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoryContext';

type WriterLetterParams = {
  categoryId?: string;
  parentId?: string;
  threadId?: string;
  category?: any;
};

// Common emoji moods that users can select quickly
const SUGGESTED_MOODS = ['😊', '😔', '😡', '😢', '😂', '😍', '🤔', '😴', '😎', '😒', '👍', '👎', '❤️', '😱', '🙏'];

const WriteLetterScreen = () => {
  const { user, profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriterLetterParams>, string>>();
  const theme = useTheme();
  const { categories, loading: loadingCategories, selectedCategory, setSelectedCategory } = useCategories();
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
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

      // Use provided title or generate an automatic one if empty
      let letterTitle = title.trim();
      if (!letterTitle) {
        // Use the first line or first few words as an automatic title
        letterTitle = content.split('\n')[0].trim();
        if (letterTitle.length > 50) {
          letterTitle = letterTitle.substring(0, 47) + '...';
        } else if (letterTitle.length < 3) {
          // If first line is too short, use first few words of content
          letterTitle = content.trim().substring(0, 50);
          if (letterTitle.length === 50) {
            letterTitle = letterTitle + '...';
          }
        }
      }

      // Create the letter in the database
      const { data, error } = await supabase
        .from('letters')
        .insert([
          {
            title: letterTitle,
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

      // On success, navigate to the Main stack with Home tab
      navigation.navigate('Main');
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
    setMoodEmoji(emoji === moodEmoji ? '' : emoji); // Toggle the emoji if it's already selected
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView 
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]} 
        contentContainerStyle={styles.contentContainer}
      >
        <Headline style={[styles.headline, { color: theme.colors.onBackground }]}>Write a Letter</Headline>
        <Subheading style={[styles.subheading, { color: theme.colors.onSurfaceDisabled }]}>Share your thoughts with the community</Subheading>
        
        <Divider style={[styles.divider, { backgroundColor: theme.colors.surfaceDisabled }]} />

        <View style={styles.moodContainer}>
          <Text style={[styles.label, { color: theme.colors.onBackground }]}>Your Mood (Required)</Text>
          
          <View style={[styles.selectedEmojiContainer, { 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline
          }]}>
            {moodEmoji ? (
              <Text style={styles.selectedEmoji}>{moodEmoji}</Text>
            ) : (
              <Text style={[styles.placeholderEmoji, { color: theme.colors.onSurfaceDisabled }]}>Select an emoji</Text>
            )}
          </View>
          
          <Surface style={[styles.emojiSuggestions, { backgroundColor: theme.colors.surface }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SUGGESTED_MOODS.map((emoji, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.emojiOption,
                    emoji === moodEmoji && [styles.selectedEmojiOption, { backgroundColor: theme.colors.primary }]
                  ]}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Surface>
        </View>
        
        <Text style={[styles.label, { color: theme.colors.onBackground }]}>Category (Required)</Text>
        {loadingCategories ? (
          <ActivityIndicator animating={true} style={styles.loading} color={theme.colors.primary} />
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
                  { backgroundColor: theme.colors.surface },
                  selectedCategory?.id === category.id && { backgroundColor: theme.colors.primary }
                ]}
                textStyle={[
                  { color: theme.colors.onSurface },
                  selectedCategory?.id === category.id && { color: theme.colors.onPrimary }
                ]}
              >
                {category.name}
              </Chip>
            ))}
          </ScrollView>
        )}
        
        <LabeledTextInput
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter a title for your letter"
          maxLength={100}
          inputStyle={styles.titleInput}
        />
        
        <LabeledTextInput
          label="Your Letter"
          value={content}
          onChangeText={setContent}
          placeholder="Write your letter here..."
          multiline={true}
          numberOfLines={10}
          maxLength={5000}
          inputStyle={styles.contentInput}
        />
        
        <LabeledTextInput
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Enter a display name for this letter"
          maxLength={50}
          required={true}
          hint="This name will be shown publicly with your letter"
          inputStyle={styles.displayNameInput}
        />
        
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji}
          loading={isSubmitting}
        >
          <Text style={{ 
            color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji 
              ? theme.colors.onSurfaceDisabled 
              : 'white'
          }}>
            Submit Letter + 5{' '}
            <Text style={{ 
              color: isSubmitting || !content.trim() || !selectedCategory || !displayName.trim() || !moodEmoji 
                ? theme.colors.onSurfaceDisabled 
                : '#FFD700',
              fontSize: 18
            }}>★</Text>
          </Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  moodContainer: {
    marginBottom: 24,
  },
  selectedEmojiContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedEmoji: {
    fontSize: 36,
  },
  placeholderEmoji: {
    fontSize: 16,
  },
  emojiSuggestions: {
    padding: 12,
    borderRadius: 8,
    elevation: 2,
  },
  emojiOption: {
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  selectedEmojiOption: {
    borderWidth: 1,
  },
  emojiText: {
    fontSize: 28,
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
  contentInput: {
    marginBottom: 16,
    minHeight: 200,
  },
  titleInput: {
    marginBottom: 8,
  },
  displayNameInput: {
    marginBottom: 8,
  },
  displayNameHint: {
    fontSize: 12,
    marginBottom: 24,
  },
  submitButton: {
    padding: 8,
  },
  loading: {
    marginVertical: 16,
  },
});

export default WriteLetterScreen; 