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
const SUGGESTED_MOODS = ['😊', '😔', '😡', '😢', '😂', '😍', '🤔', '😴', '😎', '😒', '👍', '👎', '❤️', '😱', '🙏'];

const WriteLetterScreen = () => {
  const { user, profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriterLetterParams>, string>>();
  const theme = useTheme();
  
  // Get the category from route params if available
  const initialCategory = route.params?.category || null;
  
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
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
    setMoodEmoji(emoji === moodEmoji ? '' : emoji); // Toggle the emoji if it's already selected
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
          
          {/* Display the selected emoji or placeholder */}
          <View style={styles.selectedEmojiContainer}>
            {moodEmoji ? (
              <Text style={styles.selectedEmoji}>{moodEmoji}</Text>
            ) : (
              <Text style={styles.placeholderEmoji}>Select an emoji</Text>
            )}
          </View>
          
          {/* Always show emoji options */}
          <Surface style={styles.emojiSuggestions}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SUGGESTED_MOODS.map((emoji, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.emojiOption,
                    emoji === moodEmoji && styles.selectedEmojiOption
                  ]}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Surface>
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
        
        <Text style={styles.label}>Your Letter</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Write your letter here..."
          multiline
          numberOfLines={10}
          style={styles.contentInput}
          maxLength={5000}
        />
        
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Enter a display name for this letter"
          style={styles.displayNameInput}
          maxLength={50}
        />
        <Text style={styles.displayNameHint}>
          This name will be shown publicly with your letter
        </Text>
        
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={isSubmitting || !content.trim() || !selectedCategory || !displayName.trim()}
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
    marginBottom: 24,
  },
  selectedEmojiContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedEmoji: {
    fontSize: 36,
  },
  placeholderEmoji: {
    fontSize: 16,
    color: '#999',
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
    backgroundColor: 'rgba(98, 0, 238, 0.1)',
    borderWidth: 1,
    borderColor: '#6200ee',
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
    backgroundColor: '#f9f9f9',
    minHeight: 200,
  },
  titleInput: {
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  displayNameInput: {
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  displayNameHint: {
    fontSize: 12,
    color: '#666',
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