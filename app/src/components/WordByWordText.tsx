import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleProp, TextStyle, StyleSheet } from 'react-native';

interface WordByWordTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  speed?: number; // milliseconds per word
  onComplete?: () => void;
  isActive?: boolean;
}

const WordByWordText: React.FC<WordByWordTextProps> = ({
  text,
  style,
  speed = 100,
  onComplete,
  isActive = true,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const words = useRef(text.split(/\s+/)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setWordIndex(0);
    words.splice(0, words.length, ...text.split(/\s+/));
  }, [text]);

  useEffect(() => {
    if (!isActive) return;

    const revealNextWord = () => {
      if (wordIndex < words.length) {
        const nextWord = words[wordIndex];
        const space = wordIndex > 0 ? ' ' : '';
        
        setDisplayedText(prev => prev + space + nextWord);
        setWordIndex(wordIndex + 1);
        
        if (wordIndex + 1 < words.length) {
          timeoutRef.current = setTimeout(revealNextWord, speed);
        } else if (onComplete) {
          onComplete();
        }
      }
    };

    timeoutRef.current = setTimeout(revealNextWord, 0);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [wordIndex, isActive]);

  // Show all text immediately if not active
  if (!isActive && displayedText !== text) {
    setDisplayedText(text);
  }

  return <Text style={style}>{displayedText}</Text>;
};

export default WordByWordText;
