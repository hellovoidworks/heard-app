import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Headline, Divider, ActivityIndicator, Chip, useTheme, Surface } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

type WriteLetterDetailsParams = {
  title: string;
  content: string;
  categoryId?: string;
  category?: any;
};

// Common emoji moods that users can select quickly
const SUGGESTED_MOODS = ['😊', '😔', '😡', '😢', '😂', '😍', '🤔', '😴', '😎', '😒', '👍', '👎', '❤️', '😱', '🙏'];

const WriteLetterDetailsScreen = () => {
  const { user, profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriteLetterDetailsParams>, string>>();
  const theme = useTheme();
  
  // Required params from previous screen
  const title = route.params?.title || '';
  const content = route.params?.content || '';
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [categories, setCategories] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState(profile?.username || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [moodEmoji, setMoodEmoji] = useState('');

  // Update display name when profile changes
  useEffect(() => {
    if (profile?.username) {
      setDisplayName(profile.username);
    }
  }, [profile]);

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

  const handleBack = () => {
    // Navigate back to content screen with title and content
    navigation.navigate('WriteLetterContent', {
      title,
      content,
    });
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
        <Headline style={[styles.headline, { color: theme.colors.onBackground }]}>Letter Details</Headline>
        
        <View style={styles.titlePreview}>
          <Text style={[styles.previewLabel, { color: theme.colors.onSurfaceDisabled }]}>Title:</Text>
          <Text style={[styles.previewContent, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        
        <Divider style={[styles.divider, { backgroundColor: theme.colors.surfaceDisabled }]} />

        <View style={styles.moodContainer}>
          <Text style={[styles.label, { color: theme.colors.onBackground }]}>Your Mood</Text>
          
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
        
        <Text style={[styles.label, { color: theme.colors.onBackground }]}>Category</Text>
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
        
        <Text style={[styles.label, { color: theme.colors.onBackground }]}>Display Name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Enter a display name for this letter"
          placeholderTextColor={theme.colors.onSurfaceDisabled}
          style={[styles.displayNameInput, { 
            backgroundColor: theme.colors.surface,
            color: theme.colors.onSurface
          }]}
          maxLength={50}
          theme={{ colors: { text: theme.colors.onSurface } }}
        />
        <Text style={[styles.displayNameHint, { color: theme.colors.onSurfaceDisabled }]}>
          This name will be shown publicly with your letter
        </Text>
        
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={handleBack}
            style={[styles.backButton, { borderColor: theme.colors.primary }]}
          >
            Back
          </Button>
          
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            disabled={isSubmitting || !selectedCategory || !displayName.trim()}
            loading={isSubmitting}
          >
            Submit Letter
          </Button>
        </View>
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
  divider: {
    marginVertical: 16,
  },
  titlePreview: {
    marginTop: 8,
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  previewContent: {
    fontSize: 16,
    fontWeight: '500',
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
  displayNameInput: {
    marginBottom: 8,
  },
  displayNameHint: {
    fontSize: 12,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backButton: {
    flex: 1,
    marginRight: 8,
  },
  submitButton: {
    flex: 2,
    marginLeft: 8,
  },
  loading: {
    marginVertical: 16,
  },
});

export default WriteLetterDetailsScreen; 