import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Adjust, AdjustEvent } from 'react-native-adjust';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity, FlatList, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, TextInput, Animated, Easing, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BlockReportBottomSheet, { BlockReportBottomSheetRef } from '../components/BlockReportBottomSheet';
import ReportReasonModal from '../components/ReportReasonModal';
import { reportContent, ReportType } from '../services/reportService';
import AnimatedEmoji from '../components/AnimatedEmoji';
import WordByWordText from '../components/WordByWordText';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, TextInput as PaperTextInput, IconButton, Surface, useTheme, Menu, Divider } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LetterTitleCard from '../components/LetterTitleCard';
import eventEmitter, { EVENTS } from '../utils/eventEmitter';
import detailScreenPreloader from '../utils/detailScreenPreloader';
import tabDataPreloader from '../utils/tabDataPreloader';

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
  const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);
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
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  
  // Refs for bottom sheets
  const blockReportBottomSheetRef = useRef<BlockReportBottomSheetRef>(null);
  
  // Animation values for discard effect
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

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
      
      // Show emoji with animation
      
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
        
      // Track the Sent Reaction event with Adjust
      const adjustEvent = new AdjustEvent('v4v0k1');
      Adjust.trackEvent(adjustEvent);
        
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
      
      // The letter will be closed by the AnimatedEmoji component's onAnimationComplete callback
      
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
            reply_to_id: null, // Direct reply to the letter
            reply_to_user_id: letter.author_id // Add the original letter author's ID
          }
        ]);
        
      if (error) {
        console.error('Error sending response:', error);
        return;
      }

      // Award 2 stars for replying
      console.log('LetterDetailScreen: About to update stars for replying');
      const { error: starError } = await updateStars(2);
      if (starError) {
        console.error('Error updating stars:', starError);
        // Don't block navigation if star update fails
      } else {
        try {
          // Store the reward amount in AsyncStorage so we can trigger the animation AFTER navigation
          await AsyncStorage.setItem('@heard_app/pending_star_reward', '2');
          console.log('LetterDetailScreen: Stored pending reward of 2 stars in AsyncStorage');
          console.log('LetterDetailScreen: Will show animation after navigation completes');
          
          // Don't emit the event here - we'll do it after navigation in the HomeScreen
        } catch (error) {
          console.error('Error storing pending reward:', error);
        }
      }
      
      // Clear response text and close modal
      setResponseText('');
      setResponseModalVisible(false);
      
      // Hide bottom navigation buttons
      setHideBottomNav(true);
      
      // Close the letter immediately since we'll show the animation after navigation
      console.log('LetterDetailScreen: Closing letter, will show animation after navigation');
      if (onClose) {
        onClose();
      } else {
        navigation.goBack();
      }
      
    } catch (error) {
      console.error('Error sending response:', error);
    } finally {
      setSendingResponse(false);
    }
  };

  const handleDiscard = () => {
    setIsDiscarding(true);
    setHideBottomNav(true);
    
    // Create a sequence of animations for the discard effect
    Animated.sequence([
      // First crumple the paper (scale down and rotate slightly)
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(2))
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]),
      // Then toss it away (move down and fade out)
      Animated.parallel([
        Animated.timing(translateYAnim, {
          toValue: 1000,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.cubic
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true
        })
      ])
    ]).start(() => {
      // Only navigate back after animation completes
      if (onClose) {
        onClose();
      } else {
        navigation.goBack();
      }
    });
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

              <View style={[styles.modalButtons, { paddingBottom: Math.max(16, 16) }]}>
                <Button
                  mode="contained"
                  onPress={handleSendResponse}
                  disabled={!responseText.trim() || sendingResponse}
                  loading={sendingResponse}
                  style={{ flex: 1 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text>Send Reply +2</Text>
                    <Text style={{
                      color: !responseText.trim() || sendingResponse ? theme.colors.onSurfaceDisabled : '#FFD700',
                      fontSize: 16,
                      marginTop: 1,
                      marginLeft: 0
                    }}>★</Text>
                  </View>
                </Button>
              </View>
            </Surface>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const handleBlock = () => {
    // Close the bottom sheet
    blockReportBottomSheetRef.current?.close();
    
    // Show confirmation alert before blocking
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? You will no longer see any content from them, and they will not be able to see your content.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            // In a real implementation, we would call the API to block the user
            console.log(`Blocking user: ${letter?.author_id}`);
            
            // Here you would add the actual blocking logic
            // Then navigate back
            if (onClose) {
              onClose();
            } else {
              navigation.goBack();
            }
          }
        }
      ]
    );
  };
  
  const handleReport = (reason?: string) => {
    // If we have a reason, it means the modal has already been shown
    // and we're getting the callback with the reason
    if (reason) {
      handleSubmitReportWithReason(reason);
    }
  };
  
  const handleSubmitReportWithReason = async (reason: string) => {
    // Show loading indicator or toast message
    // You could add a loading state here if desired
    
    try {
      // Call the report content API
      const { success, error } = await reportContent(letterId, ReportType.LETTER, reason, undefined);
      
      if (success) {
        // Show success message
        console.log('Letter reported successfully');
        
        // Show success alert and navigate back only after user clicks OK
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. We will review this content shortly.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back
                if (onClose) {
                  onClose();
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else {
        // Show error message
        console.error('Failed to report letter:', error);
        // Show error alert
        Alert.alert('Report Failed', 'Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error('Error reporting letter:', error);
      // Show error alert
      Alert.alert('Error', 'An error occurred while submitting your report. Please try again.');
    }
  };

  const renderBlockReportBottomSheet = () => {
    return (
      <BlockReportBottomSheet
        ref={blockReportBottomSheetRef}
        onBlock={handleBlock}
        onReport={handleReport}
        contentType="letter"
      />
    );
  };

  useEffect(() => {
    fetchLetter();
    // Reset animation state when letter changes
    setTextRevealed(false);
    setIsAnimating(true);
    setShowFullText(false);
  }, [letterId]);

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

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-10deg']
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View
        style={[
          { flex: 1 },
          isDiscarding && {
            transform: [
              { scale: scaleAnim },
              { rotate: rotate },
              { translateY: translateYAnim }
            ],
            opacity: opacityAnim
          }
        ]}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => blockReportBottomSheetRef.current?.open()}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  // Refresh data here
                } catch (error) {
                  console.error('Error refreshing data:', error);
                } finally {
                  setRefreshing(false);
                }
              }}
              tintColor={theme.colors.primary}
            />
          }
        >
          <LetterTitleCard letter={letter} />

          <View style={styles.letterContent}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                // Reveal text on press
              }}
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
                style={[styles.actionButton, { borderColor: '#888888', flex: 1 }]}
                textColor="#888888"
              >
                Discard
              </Button>
              <Button
                mode="outlined"
                onPress={() => setReactionModalVisible(true)}
                icon="emoticon-happy-outline"
                style={[styles.actionButton, { borderColor: 'white', flex: 1 }]}
                textColor="white"
              >
                React
              </Button>
              <Button
                mode="contained"
                onPress={handleOpenResponseModal}
                style={[styles.actionButton, { flex: 1.2 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text>Reply +2</Text>
                  <Text style={{
                    color: '#FFD700',
                    fontSize: 16,
                    marginTop: 1,
                    marginLeft: 0
                  }}>★</Text>
                </View>
              </Button>
            </View>
          </View>
        )}

        {showEmoji && selectedEmoji && (
          <AnimatedEmoji
            emoji={selectedEmoji}
            animation="random"
            size={100}
            visible={showEmoji}
            showOverlay={true}
            onAnimationComplete={() => {
              setShowEmoji(false);
              setHideBottomNav(false);
              setSendingReaction(false);

              // Close letter and go back to home screen after reaction
              if (onClose) {
                onClose();
              } else {
                navigation.goBack();
              }
            }}
          />
        )}

        {renderReactionModal()}
        {renderResponseModal()}
        {renderBlockReportBottomSheet()}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 5,
    paddingRight: 10,
    paddingBottom: 5,
    zIndex: 10,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    width: '100%',
  },
  optionItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
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
    marginTop: -10, // Reduce the gap between header and content
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

});

export default LetterDetailScreen;