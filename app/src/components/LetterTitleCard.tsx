import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Text } from 'react-native-paper';
import { LetterWithDetails } from '../types/database.types';

interface LetterTitleCardProps {
  letter: LetterWithDetails;
  userReaction?: string | null;
}

const LetterTitleCard: React.FC<LetterTitleCardProps> = ({ letter, userReaction }) => {
  const categoryColor = letter.category?.color || '#333333';
  // Use category color with opacity 0.2 for background
  const backgroundColor = `${categoryColor}33`; // 20% opacity

  return (
    <Card
      style={[
        styles.headerCard,
        { 
          backgroundColor,
          borderWidth: 1,
          borderColor: categoryColor 
        }
      ]}
    >
      <Card.Content>
        <View style={styles.letterHeader}>
          <View style={styles.moodEmojiContainer}>
            <Text style={styles.moodEmoji}>{letter.mood_emoji || '😊'}</Text>
          </View>
          <View style={styles.letterTitleContainer}>
            <Title style={styles.letterTitle}>{letter.title}</Title>
            <View style={styles.metadataContainer}>
              <View style={[styles.categoryContainer, { backgroundColor: `${categoryColor}66` }]}>
                <Text style={styles.categoryName}>
                  {letter.category?.name?.toUpperCase() || ''}
                </Text>
              </View>
              {userReaction && (
                <Text style={styles.reactionText}>
                  You reacted with {userReaction}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  headerCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 4,
  },
  letterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodEmojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moodEmoji: {
    fontSize: 28,
  },
  letterTitleContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  letterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
    fontFamily: 'SourceCodePro-SemiBold',
    lineHeight: 22,
    letterSpacing: -1,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryContainer: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  reactionText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

export default LetterTitleCard; 