import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface ReactionDisplayProps {
  username: string;
  emoji: string;
  date: string;
  isCurrentUser?: boolean;
}

const ReactionDisplay: React.FC<ReactionDisplayProps> = ({ 
  username, 
  emoji, 
  date, 
  isCurrentUser = false 
}) => {
  const theme = useTheme();
  
  return (
    <View style={styles.container}>
      <Text 
        style={[
          styles.reactionText, 
          { 
            backgroundColor: theme.colors.surfaceVariant,
            color: 'white'
          }
        ]}
      >
        {isCurrentUser ? 'You' : username} reacted with {emoji} on {date}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  reactionText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  }
});

export default ReactionDisplay;
