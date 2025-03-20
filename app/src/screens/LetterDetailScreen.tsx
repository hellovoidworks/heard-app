import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator, Button, TextInput, IconButton, Surface } from 'react-native-paper';
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
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent}>
            <Text style={styles.modalTitle}>React to this letter</Text>
            
            <View style={styles.emojiGrid}>
              {REACTION_EMOJIS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    styles.emojiButton,
                    userReactions[item.emoji] ? styles.selectedEmojiButton : null
                  ]}
                  onPress={() => handleReaction(item.emoji)}
                  disabled={sendingReaction}
                >
                  <Text style={styles.emoji}>{item.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Button 
              mode="outlined" 
              onPress={() => setReactionModalVisible(false)}
              style={styles.closeButton}
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
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent}>
            <Text style={styles.modalTitle}>Respond to this letter</Text>
            
            <TextInput
              label="Your message"
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={6}
              style={styles.responseInput}
            />
            
            <View style={styles.modalButtons}>
              <Button 
                mode="outlined" 
                onPress={() => setResponseModalVisible(false)}
                style={[styles.modalButton, styles.cancelButton]}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleSendResponse}
                loading={sendingResponse}
                disabled={sendingResponse || !responseText.trim()}
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={styles.errorContainer}>
        <Text>Letter not found</Text>
      </View>
    );
  }
  
  const isAuthoredByUser = user && letter.author_id === user.id;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Card style={styles.letterCard}>
          <Card.Content>
            <Title style={styles.title}>{letter.title}</Title>
            
            <View style={styles.metaContainer}>
              <Chip icon="account" style={styles.chip}>{letter.display_name}</Chip>
              <Chip icon="tag" style={styles.chip}>{letter.category?.name}</Chip>
              <Text style={styles.date}>
                {format(new Date(letter.created_at), 'MMM d, yyyy')}
              </Text>
            </View>
            
            <Paragraph style={styles.content}>{letter.content}</Paragraph>
            
            {letterReactions.length > 0 && (
              <View style={styles.reactionsContainer}>
                {letterReactions.map((reaction, index) => (
                  <Chip 
                    key={index} 
                    style={[
                      styles.reactionChip,
                      userReactions[reaction.emoji] ? styles.userReactionChip : null
                    ]}
                    onPress={() => handleReaction(reaction.emoji)}
                  >
                    {reaction.emoji} {reaction.count}
                  </Chip>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
      
      {!isAuthoredByUser && user && (
        <View style={styles.buttonsContainer}>
          <Button 
            mode="outlined" 
            icon="emoticon-outline"
            onPress={() => setReactionModalVisible(true)} 
            style={styles.actionButton}
          >
            React
          </Button>
          <Button 
            mode="contained" 
            icon="reply"
            onPress={() => setResponseModalVisible(true)} 
            style={styles.actionButton}
          >
            Respond
          </Button>
        </View>
      )}
      
      {renderReactionModal()}
      {renderResponseModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterCard: {
    margin: 16,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    alignItems: 'center',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 8,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    backgroundColor: '#f0f0f0',
  },
  selectedEmojiButton: {
    backgroundColor: '#e0f0ff',
    borderWidth: 2,
    borderColor: '#6200ee',
  },
  emoji: {
    fontSize: 24,
  },
  closeButton: {
    marginTop: 16,
  },
  responseInput: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  cancelButton: {
    borderColor: '#999',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  reactionChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  userReactionChip: {
    backgroundColor: '#e0f0ff',
  },
});

export default LetterDetailScreen; 