import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleProp, TextStyle, StyleSheet, ScrollView } from 'react-native';

interface WordByWordTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  speed?: number; // milliseconds per word
  onComplete?: () => void;
  isActive?: boolean;
  scrollViewRef?: React.RefObject<ScrollView>;
  autoScroll?: boolean;
}

const WordByWordText: React.FC<WordByWordTextProps> = ({
  text,
  style,
  speed = 100,
  onComplete,
  isActive = true,
  scrollViewRef,
  autoScroll = true,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const words = useRef(text.split(/\s+/)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textRef = useRef<Text>(null);

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
        
        // Scroll to keep up with the text if autoScroll is enabled
        if (autoScroll && scrollViewRef?.current && textRef.current) {
          // Use a small delay to ensure the text has rendered
          setTimeout(() => {
            textRef.current?.measureLayout(
              scrollViewRef.current as any,
              (x, y, width, height) => {
                // Scroll to the bottom of the current text with some padding
                scrollViewRef.current?.scrollTo({
                  y: y + height - 200, // 200px from bottom for context
                  animated: true
                });
              },
              () => console.log('Measurement failed')
            );
          }, 10);
        }
        
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

  return <Text ref={textRef} style={style}>{displayedText}</Text>;
};

export default WordByWordText;
