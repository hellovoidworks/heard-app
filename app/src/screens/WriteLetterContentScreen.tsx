import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoryContext';

type WriteLetterContentParams = {
  title?: string;
  content?: string;
};

const WriteLetterContentScreen = () => {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, WriteLetterContentParams>, string>>();
  const theme = useTheme();
  const { loading: loadingCategories } = useCategories();

  // Get initial values from route params if available (for when returning from details screen)
  const initialTitle = route.params?.title || '';
  const initialContent = route.params?.content || '';

  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);

  const handleContinue = () => {
    if (!content.trim()) {
      return; // Don't proceed if content is empty
    }

    // Generate automatic title if empty
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

    // Navigate to the details screen with the content and title
    navigation.navigate('WriteLetterDetails', {
      title: letterTitle,
      content: content.trim(),
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.contentContainer}>
          <View style={styles.subjectRow}>
            <Text style={[styles.subjectLabel, { color: theme.colors.onBackground }]}>Subject</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Your subject header appears to the public (optional)"
                placeholderTextColor={theme.colors.onSurfaceDisabled}
                style={[styles.titleInput, { backgroundColor: 'transparent', color: theme.colors.onSurface }]}
                maxLength={100}
                theme={{ colors: { text: theme.colors.onSurface, primary: 'transparent' } }}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                mode="flat"
                dense
                multiline
                numberOfLines={2}
              />
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.letterContainer}>
            <Text style={[styles.label, { color: theme.colors.onBackground }]}>Your letter</Text>
            <ScrollView style={styles.contentScrollView}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Write about your worries and issues or use a prompt for some inspiration.."
                placeholderTextColor={theme.colors.onSurfaceDisabled}
                multiline
                style={[styles.contentInput, { 
                  backgroundColor: 'transparent', 
                  color: theme.colors.onSurface,
                  textAlignVertical: 'top'
                }]}
                maxLength={5000}
                theme={{ colors: { text: theme.colors.onSurface, primary: 'transparent' } }}
                underlineColor="transparent"
                mode="flat"
              />
            </ScrollView>
          </View>
        </View>
        
        <View style={[styles.buttonContainer, { backgroundColor: theme.colors.background }]}>
          <Button
            mode="contained"
            onPress={handleContinue}
            style={styles.continueButton}
            disabled={!content.trim()}
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
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  subjectLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    width: '22%',
    marginRight: 8,
    paddingTop: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  letterContainer: {
    flex: 1,
    marginBottom: 8,
  },
  contentScrollView: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 40,
  },
  contentInput: {
    fontSize: 16,
    paddingHorizontal: 0,
    minHeight: '100%',
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  continueButton: {
    padding: 8,
  },
});

export default WriteLetterContentScreen; 