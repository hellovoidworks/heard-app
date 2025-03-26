import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Text } from 'react-native-paper';
import { LetterWithDetails } from '../types/database.types';

interface LetterTitleCardProps {
  letter: LetterWithDetails;
}

const LetterTitleCard: React.FC<LetterTitleCardProps> = ({ letter }) => {
  return (
    <Card
      style={[
        styles.headerCard,
        { backgroundColor: letter.category?.color || '#333333' }
      ]}
    >
      <Card.Content>
        <View style={styles.letterHeader}>
          <View style={styles.moodEmojiContainer}>
            <Text style={styles.moodEmoji}>{letter.mood_emoji || '😊'}</Text>
          </View>
          <View style={styles.letterTitleContainer}>
            <Title style={styles.letterTitle}>{letter.title}</Title>
            <Text style={styles.categoryName}>
              {letter.category?.name?.toUpperCase() || ''}
            </Text>
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moodEmoji: {
    fontSize: 24,
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
  categoryName: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

export default LetterTitleCard; 