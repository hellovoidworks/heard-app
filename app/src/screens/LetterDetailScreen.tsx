import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity, FlatList, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, TextInput } from 'react-native';
import WordByWordText from '../components/WordByWordText';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, TextInput as PaperTextInput, IconButton, Surface, useTheme } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LetterTitleCard from '../components/LetterTitleCard';

type Props = NativeStackScreenProps<RootStackParamList, 'LetterDetail'>;

// Available reaction emojis
const REACTION_EMOJIS = [
  { emoji: '❤️', name: 'heart' },
  { emoji: '🥰', name: 'smiling_face_with_hearts' },
  { emoji: '😍', name: 'heart_eyes' },
  { emoji: '😘', name: 'kissing_heart' },
  { emoji: '😂', name: 'joy' },
  { emoji: '😲', name: 'astonished' },
  { emoji: '😢', name: 'cry' },
  { emoji: '🔥', name: 'fire' },
];

const LetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId, letter: initialLetter, onClose } = route.params;
  const [letter, setLetter] = useState<LetterWithDetails | null>(initialLetter || null);
  const [loading, setLoading] = useState(!initialLetter);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [sendingReaction, setSendingReaction] = useState(false);
  const [userReactions, setUserReactions] = useState<{[key: string]: boolean}>({});
  const [letterReactions, setLetterReactions] = useState<{emoji: string, count: number}[]>([]);
  const { user, profile, updateStars } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true); // Start animating immediately
  const [showFullText, setShowFullText] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchLetter = async () => {
    try {
      // If we already have the letter from navigation params, just fetch reactions
      if (letter) {
        setLoading(false);
        
        // Record that the user has read this letter if they are logged in
        if (user && user.id !== letter.author_id) {
          const { error: readError } = await supabase
            .from('letter_reads')
            .upsert([
              {
                user_id: user.id,
                letter_id: letterId,
                read_at: new Date().toISOString()
              }
            ], { 
              onConflict: 'user_id,letter_id',
              ignoreDuplicates: true 
            });
            
          if (readError) {
            console.error('Error recording letter read:', readError);
          }
          
          // Fetch reactions for this letter
          fetchReactions();
        }
        return;
      }
      
      // If we don't have the letter yet, fetch it from the database
      setLoading(true);
      
      // Fetch the letter details
      const { data: letterData, error: letterError } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .eq('id', letterId)
        .single();

      if (letterError) {
        console.error('Error fetching letter:', letterError);
        return;
      }

      if (letterData) {
        setLetter(letterData as LetterWithDetails);
        
        // Record that the user has read this letter if they are logged in
        if (user && user.id !== letterData.author_id) {
          const { error: readError } = await supabase
            .from('letter_reads')
            .upsert([
              {
                user_id: user.id,
                letter_id: letterId,
                read_at: new Date().toISOString()
              }
            ], { 
              onConflict: 'user_id,letter_id',
              ignoreDuplicates: true 
            });
            
          if (readError) {
            console.error('Error recording letter read:', readError);
          }
          
          // Fetch reactions for this letter
          fetchReactions();
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const fetchReactions = async () => {
    if (!user || !letterId) return;
    
    try {
      // Fetch reactions for this letter
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('reactions')
        .select('reaction_type, user_id')
        .eq('letter_id', letterId);
        
      if (reactionsError) {
        console.error('Error fetching reactions:', reactionsError);
        return;
      }
      
      if (reactionsData) {
        // Process reactions
        const userReacted: {[key: string]: boolean} = {};
        const reactionCounts: {[key: string]: number} = {};
        
        reactionsData.forEach(reaction => {
          // Count total reactions by type
          reactionCounts[reaction.reaction_type] = (reactionCounts[reaction.reaction_type] || 0) + 1;
          
          // Mark which reactions the current user has made
          if (reaction.user_id === user.id) {
            userReacted[reaction.reaction_type] = true;
          }
        });
        
        // Format for display
        const formattedReactions = Object.entries(reactionCounts).map(([emoji, count]) => ({
          emoji,
          count
        })).sort((a, b) => b.count - a.count);
        
        setLetterReactions(formattedReactions);
        setUserReactions(userReacted);
      }
    } catch (error) {
      console.error('Error processing reactions:', error);
    }
  };

  const revealText = () => {
    // When tapped, always show full text immediately
    setShowFullText(true);
    setTextRevealed(true);
    setIsAnimating(false);
  };

  useEffect(() => {
    fetchLetter();
    // Reset animation state when letter changes
    setTextRevealed(false);
    setIsAnimating(true); // Start animating immediately
    setShowFullText(false);
  }, [letterId, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetter();
  };
  
  const handleReaction = async (emoji: string) => {
    if (!user || !letter) return;
    
    try {
      setSendingReaction(true);
      setSelectedEmoji(emoji);
      
      // If user already reacted with this emoji, remove the reaction
      if (userReactions[emoji]) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('user_id', user.id)
          .eq('letter_id', letter.id)
          .eq('reaction_type', emoji);
          
        if (error) {
          console.error('Error removing reaction:', error);
          setSendingReaction(false);
          return;
        }
        
        // Successfully removed reaction, don't show emoji
        fetchReactions();
        setSendingReaction(false);
        return;
      } 
      
      // Hide bottom nav and close reaction modal
      setHideBottomNav(true);
      setReactionModalVisible(false);
      
      // Show emoji immediately when adding a reaction
      setShowEmoji(true);
      
      // Add a new reaction
      const { error } = await supabase
        .from('reactions')
        .insert([
          {
            user_id: user.id,
            letter_id: letter.id,
            reaction_type: emoji
          }
        ]);
        
      if (error) {
        console.error('Error adding reaction:', error);
        // Hide emoji if there was an error
        setShowEmoji(false);
        setHideBottomNav(false);
        setSendingReaction(false);
        return;
      }
      
      // Refresh reactions to update UI
      await fetchReactions();
      
      // Close the letter after a delay (approx 0.75 seconds)
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          navigation.goBack();
        }
      }, 750);
      
    } catch (error) {
      console.error('Error handling reaction:', error);
      // Hide emoji if there was an error
      setShowEmoji(false);
      setHideBottomNav(false);
      setSendingReaction(false);
    }
  };
  
  // Create a ref for the native TextInput inside PaperTextInput
  const inputRef = useRef<TextInput>(null);
  
  // Handle opening the response modal and focusing the input
  const handleOpenResponseModal = useCallback(() => {
    setResponseModalVisible(true);
    
    // Focus the input after the modal is visible
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 300); // Increased delay to ensure modal is fully visible
  }, []);
  
  // Effect to focus the input when the modal becomes visible
  useEffect(() => {
    if (responseModalVisible && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
    }
  }, [responseModalVisible]);

  const handleSendResponse = async () => {
    if (!user || !profile || !letter || !responseText.trim()) return;
    
    try {
      setSendingResponse(true);
      
      const { error } = await supabase
        .from('replies')
        .insert([
          {
            letter_id: letter.id,
            author_id: user.id,
            display_name: profile.username,
            content: responseText,
            reply_to_id: null // Direct reply to the letter
          }
        ]);
        
      if (error) {
        console.error('Error sending response:', error);
        return;
      }

      // Award 2 stars for replying
      const { error: starError } = await updateStars(2);
      if (starError) {
        console.error('Error updating stars:', starError);
        // Don't block navigation if star update fails
      }
      
      // Clear response text and close modal
      setResponseText('');
      setResponseModalVisible(false);
      
      // Hide bottom navigation buttons
      setHideBottomNav(true);
      
      // Close the letter after a short delay
      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          navigation.goBack();
        }
      }, 750);
      
    } catch (error) {
      console.error('Error sending response:', error);
    } finally {
      setSendingResponse(false);
    }
  };

  const handleDiscard = () => {
    if (onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  };

  const renderReactionModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={reactionModalVisible}
        onRequestClose={() => setReactionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Surface style={[styles.bottomModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setReactionModalVisible(false)}
                style={styles.closeButton}
                disabled={sendingReaction}
              />
            </View>
            
            <View style={[styles.emojiGrid, { marginBottom: Math.max(insets.bottom, 16) }]}>
              {REACTION_EMOJIS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    styles.emojiButton,
                    { backgroundColor: theme.colors.surfaceVariant }
                  ]}
                  onPress={() => handleReaction(item.emoji)}
                  disabled={sendingReaction}
                >
                  <Text style={styles.emojiText}>{item.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Surface>
        </View>
      </Modal>
    );
  };
  
  const renderResponseModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={responseModalVisible}
        onRequestClose={() => {
          Keyboard.dismiss();
          setResponseModalVisible(false);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <Surface style={[styles.bottomModalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <IconButton
                  icon="close"
                  size={20}
                  onPress={() => {
                    Keyboard.dismiss();
                    setResponseModalVisible(false);
                  }}
                  style={styles.closeButton}
                />
              </View>
              
              <PaperTextInput
                value={responseText}
                onChangeText={setResponseText}
                placeholder="Write your reply..."
                placeholderTextColor={theme.colors.onSurfaceDisabled}
                multiline
                numberOfLines={6}
                style={[styles.responseInput, { 
                  backgroundColor: 'transparent', 
                  color: theme.colors.onSurface,
                  textAlignVertical: 'top',
                  minHeight: 150,
                  fontSize: 16,
                  paddingHorizontal: 0
                }]}
                theme={{ colors: { text: theme.colors.onSurface, primary: 'white' } }}
                selectionColor="white"
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                mode="flat"
                render={props => (
                  <TextInput
                    {...props}
                    ref={inputRef}
                    multiline
                    style={[props.style, { color: theme.colors.onSurface }]}
                    placeholder="Write your reply..."
                    placeholderTextColor={theme.colors.onSurfaceDisabled}
                  />
                )}
              />
              
              <View style={[styles.modalButtons, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <Button
                  mode="contained"
                  onPress={handleSendResponse}
                  disabled={!responseText.trim() || sendingResponse}
                  loading={sendingResponse}
                  style={{ flex: 1 }}
                >
                  Send Reply +2{' '}
                  <Text style={{ 
                    color: !responseText.trim() || sendingResponse ? theme.colors.onSurfaceDisabled : '#FFD700',
                    fontSize: 16
                  }}>★</Text>
                </Button>
              </View>
            </Surface>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onBackground }}>Letter not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }
  
  const isAuthoredByUser = user && letter.author_id === user.id;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <LetterTitleCard letter={letter} />

        <View style={styles.letterContent}>
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: theme.colors.primary }]}>
              {letter.display_name || letter.author?.username || 'Unknown User'}
            </Text>
            <Text style={[styles.date, { color: theme.colors.onSurfaceDisabled }]}>
              {format(new Date(letter.created_at), 'MMM d, yyyy')}
            </Text>
          </View>

          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={revealText}
            style={styles.contentContainer}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.textContainer}>
                {showFullText ? (
                  <Text style={[styles.content, { color: theme.colors.onSurface }]}>
                    {letter.content}
                  </Text>
                ) : (
                  <WordByWordText
                    text={letter.content}
                    speed={200} // Adjusted speed (milliseconds per word) - slowed down from 50ms to 200ms
                    style={[styles.content, { color: theme.colors.onSurface }]}
                    onComplete={() => {
                      setTextRevealed(true);
                      setIsAnimating(false);
                    }}
                    isActive={isAnimating}
                    scrollViewRef={scrollViewRef}
                    autoScroll={false} // Removed autoscrolling
                    wordCountThreshold={150} // Show full text after 150 words
                    onWordThresholdReached={() => {
                      // Use a small timeout to ensure smooth transition
                      setTimeout(() => {
                        setShowFullText(true); // Show full text after reaching threshold
                        setTextRevealed(true);
                        setIsAnimating(false);
                      }, 50);
                    }}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!hideBottomNav && (
        <View style={[styles.actionButtonsContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={handleDiscard}
              icon="close"
              style={[styles.actionButton, { borderColor: theme.colors.error }]}
              textColor={theme.colors.error}
            >
              Discard
            </Button>
            <Button
              mode="outlined"
              onPress={() => setReactionModalVisible(true)}
              icon="emoticon-happy-outline"
              style={styles.actionButton}
            >
              React
            </Button>
            <Button
              mode="contained"
              onPress={handleOpenResponseModal}
              icon="reply"
              style={styles.actionButton}
            >
              Reply
            </Button>
          </View>
        </View>
      )}

      {showEmoji && (
        <View style={styles.emojiDisplayContainer}>
          <View style={styles.emojiOverlay} />
          <Text style={styles.largeEmoji}>{selectedEmoji}</Text>
        </View>
      )}

      {renderReactionModal()}
      {renderResponseModal()}
    </SafeAreaView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 16,
  },
  letterContent: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorName: {
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
  },
  contentContainer: {
    marginBottom: 24,
  },
  contentWrapper: {
    position: 'relative',
  },
  textContainer: {
    minHeight: 100, // Provide minimum height to prevent layout shifts
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System', // Ensure consistent font
  },


  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  reactionChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  actionButtonsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bottomModalContent: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButton: {
    margin: -8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emojiButton: {
    width: '22%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '1.5%',
    borderRadius: 9999, // Using a very large value ensures a perfect circle regardless of size
  },
  selectedEmojiButton: {
    // No special styling for selected emoji buttons
  },
  emojiText: {
    fontSize: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  responseInput: {
    marginBottom: 16,
    borderWidth: 0,
    borderRadius: 0,
  },
  emojiDisplayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  emojiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  largeEmoji: {
    fontSize: 100,
    marginBottom: 20,
    zIndex: 1000,
  },
});

export default LetterDetailScreen; 