import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, TextInput, IconButton, Surface, useTheme } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'LetterDetail'>;

// Available reaction emojis
const REACTION_EMOJIS = [
  { emoji: '❤️', name: 'heart' },
  { emoji: '👍', name: 'thumbs_up' },
  { emoji: '👏', name: 'clap' },
  { emoji: '😊', name: 'smile' },
  { emoji: '😢', name: 'sad' },
  { emoji: '🙏', name: 'pray' },
  { emoji: '💯', name: 'hundred' },
  { emoji: '🔥', name: 'fire' },
];

const LetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [sendingReaction, setSendingReaction] = useState(false);
  const [userReactions, setUserReactions] = useState<{[key: string]: boolean}>({});
  const [letterReactions, setLetterReactions] = useState<{emoji: string, count: number}[]>([]);
  const { user, profile } = useAuth();
  const theme = useTheme();

  const fetchLetter = async () => {
    try {
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

  useEffect(() => {
    fetchLetter();
  }, [letterId, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetter();
  };
  
  const handleReaction = async (emoji: string) => {
    if (!user || !letter) return;
    
    try {
      setSendingReaction(true);
      
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
          return;
        }
      } else {
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
          return;
        }
      }
      
      // Refresh reactions
      fetchReactions();
      setReactionModalVisible(false);
    } catch (error) {
      console.error('Error handling reaction:', error);
    } finally {
      setSendingReaction(false);
    }
  };
  
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
      
      // Clear response text and close modal
      setResponseText('');
      setResponseModalVisible(false);
      
      // Show confirmation
      // You could add a toast notification here
      
    } catch (error) {
      console.error('Error sending response:', error);
    } finally {
      setSendingResponse(false);
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
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <Surface style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>React to this letter</Text>
            
            <View style={styles.emojiGrid}>
              {REACTION_EMOJIS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    styles.emojiButton,
                    { backgroundColor: theme.colors.surfaceVariant },
                    userReactions[item.emoji] && [styles.selectedEmojiButton, { backgroundColor: theme.colors.primary }]
                  ]}
                  onPress={() => handleReaction(item.emoji)}
                  disabled={sendingReaction}
                >
                  <Text style={styles.emojiText}>{item.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Button 
              mode="outlined" 
              onPress={() => setReactionModalVisible(false)}
              style={styles.modalButton}
            >
              Close
            </Button>
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
        onRequestClose={() => setResponseModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <Surface style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Write a response</Text>
            
            <TextInput
              value={responseText}
              onChangeText={setResponseText}
              placeholder="Write your response..."
              placeholderTextColor={theme.colors.onSurfaceDisabled}
              multiline
              numberOfLines={4}
              style={[styles.responseInput, { 
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline
              }]}
              theme={{ colors: { text: theme.colors.onSurface } }}
            />
            
            <View style={styles.modalButtons}>
              <Button 
                mode="outlined" 
                onPress={() => setResponseModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSendResponse}
                disabled={!responseText.trim() || sendingResponse}
                loading={sendingResponse}
                style={styles.modalButton}
              >
                Send
              </Button>
            </View>
          </Surface>
        </View>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Surface style={[styles.letterContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.letterHeader}>
            <Title style={{ color: theme.colors.onSurface }}>{letter.title}</Title>
            <Chip 
              icon="tag" 
              style={[styles.categoryChip, { backgroundColor: theme.colors.surfaceVariant }]}
              textStyle={{ color: theme.colors.onSurfaceVariant }}
            >
              {letter.category?.name}
            </Chip>
          </View>

          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: theme.colors.primary }]}>
              {letter.display_name || letter.author?.username || 'Unknown User'}
            </Text>
            <Text style={[styles.date, { color: theme.colors.onSurfaceDisabled }]}>
              {format(new Date(letter.created_at), 'MMM d, yyyy')}
            </Text>
          </View>

          {(letter as any).mood_emoji && (
            <View style={[styles.moodContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={styles.moodEmoji}>{(letter as any).mood_emoji}</Text>
            </View>
          )}

          <Paragraph style={[styles.content, { color: theme.colors.onSurface }]}>
            {letter.content}
          </Paragraph>

          <View style={styles.reactionsContainer}>
            {letterReactions.map((reaction) => (
              <Chip
                key={reaction.emoji}
                style={[
                  styles.reactionChip,
                  { backgroundColor: userReactions[reaction.emoji] ? theme.colors.primary : theme.colors.surfaceVariant }
                ]}
                textStyle={{ 
                  color: userReactions[reaction.emoji] ? theme.colors.onPrimary : theme.colors.onSurfaceVariant 
                }}
              >
                {reaction.emoji} {reaction.count}
              </Chip>
            ))}
          </View>

          <View style={styles.actionButtons}>
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
              onPress={() => navigation.navigate('ThreadDetail', { letterId: letter.id })}
              icon="chat-outline"
              style={styles.actionButton}
            >
              View Conversation
            </Button>
          </View>
        </Surface>
      </ScrollView>

      {renderReactionModal()}
      {renderResponseModal()}
    </View>
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
  letterContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  letterHeader: {
    marginBottom: 16,
  },
  categoryChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
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
  moodContainer: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  moodEmoji: {
    fontSize: 24,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 20,
    borderRadius: 8,
    width: '80%',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emojiButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderRadius: 30,
  },
  selectedEmojiButton: {
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  responseInput: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
  },
});

export default LetterDetailScreen; 