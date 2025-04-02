import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, TouchableOpacity, Text as RNText, Animated } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoryContext';
import { useFonts } from 'expo-font';
import { Inter_700Bold } from '@expo-google-fonts/inter';

type WriteLetterContentParams = {
  title?: string;
  content?: string;
  moodEmoji?: string;
};

const WriteLetterContentScreen = () => {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriteLetterContentParams>, string>>();
  const theme = useTheme();
  const { loading: loadingCategories } = useCategories();
  
  // Load Inter font
  const [fontsLoaded] = useFonts({
    Inter_700Bold
  });

  // Get initial values from route params if available (for when returning from details screen)
  const initialContent = route.params?.content || '';
  const initialMoodEmoji = route.params?.moodEmoji || '';

  const [content, setContent] = useState(initialContent);
  const [moodEmoji, setMoodEmoji] = useState(initialMoodEmoji);

  const handleContinue = () => {
    if (!content.trim()) {
      return; // Don't proceed if content is empty
    }

    if (!moodEmoji) {
      return; // Don't proceed if mood is not selected
    }

    // Generate automatic title from first line or first few words
    let letterTitle = content.split('\n')[0].trim();
    if (letterTitle.length > 50) {
      letterTitle = letterTitle.substring(0, 47) + '...';
    } else if (letterTitle.length < 3) {
      // If first line is too short, use first few words of content
      letterTitle = content.trim().substring(0, 50);
      if (letterTitle.length === 50) {
        letterTitle = letterTitle + '...';
      }
    }

    // Navigate to the details screen with the content, mood emoji, and generated title
    navigation.navigate('WriteLetterDetails', {
      title: letterTitle,
      content: content.trim(),
      moodEmoji: moodEmoji
    });
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <Text style={[styles.label, { color: theme.colors.onBackground, fontFamily: 'Inter_700Bold' }]}>Select Your Mood</Text>
          
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
          
          <View style={styles.divider} />
          
          <View style={styles.letterContainer}>
            <Text style={[styles.label, { color: theme.colors.onBackground, fontFamily: 'Inter_700Bold' }]}>Your mail</Text>
            <ScrollView style={styles.contentScrollView}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder={`This is a safe space for honest expression and getting your questions answered.

What's on your mind? How was your day?

What advice are you seeking right now?

What worries are keeping you up at night?

What confessions are you holding onto?

What are you currently looking for?`}
                placeholderTextColor={theme.colors.onSurfaceDisabled}
                multiline
                style={[styles.contentInput, { 
                  backgroundColor: 'transparent', 
                  color: theme.colors.onSurface,
                  textAlignVertical: 'top'
                }]}
                maxLength={5000}
                theme={{ colors: { text: theme.colors.onSurface, primary: 'white' } }}
                selectionColor="white"
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                mode="flat"
              />
            </ScrollView>
          </View>
        </ScrollView>
        
        <View style={[styles.buttonContainer, { backgroundColor: theme.colors.background, borderTopWidth: 0 }]}>
          <Button
            mode="contained"
            onPress={handleContinue}
            style={styles.continueButton}
            disabled={!content.trim() || !moodEmoji}
          >
            Continue
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
  letterContainer: {
    flex: 1,
    marginBottom: 8,
  },
  contentScrollView: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 8,
  },
  contentInput: {
    fontSize: 16,
    paddingHorizontal: 0,
    minHeight: '100%',
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 8,
  },
  continueButton: {
    padding: 8,
  },
  moodGrid: {
    marginTop: 16,
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
});

export default WriteLetterContentScreen; 