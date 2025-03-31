import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleProp, TextStyle, ScrollView } from 'react-native';

interface WordByWordTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  speed?: number; // milliseconds per word
  onComplete?: () => void;
  isActive?: boolean;
  scrollViewRef?: React.RefObject<ScrollView>;
  autoScroll?: boolean;
  wordCountThreshold?: number;
  onWordThresholdReached?: () => void;
}

const WordByWordText: React.FC<WordByWordTextProps> = ({
  text,
  style,
  speed = 100,
  onComplete,
  isActive = true,
  scrollViewRef,
  autoScroll = false,
  wordCountThreshold = 150,
  onWordThresholdReached,
}) => {
  // Track both words and their following spaces/newlines
  const tokens = useRef<Array<{ text: string, followedBy: 'space' | 'newline' | 'none' }>>([]).current;
  const [visibleCount, setVisibleCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textRef = useRef<Text>(null);
  
  // Process text into tokens on mount or when text changes
  useEffect(() => {
    // Reset state
    setVisibleCount(0);
    tokens.splice(0, tokens.length);

    // Split text into words and whitespace tokens
    const parts = text.split(/([\s\n]+|[^\s\n]+)/g).filter(Boolean);
    let lastWasNewline = false;
    
    for (const part of parts) {
      if (/^[\s\n]+$/.test(part)) {
        // This is a whitespace/newline part
        if (part.includes('\n')) {
          // Count actual newlines in the text
          const newlineCount = (part.match(/\n/g) || []).length;
          // Add exactly one newline token per actual newline
          for (let i = 0; i < newlineCount; i++) {
            tokens.push({ text: '\n', followedBy: 'none' });
          }
          lastWasNewline = true;
        } else if (!lastWasNewline) {
          // Only add space after non-newline tokens
          if (tokens.length > 0) {
            tokens[tokens.length - 1].followedBy = 'space';
          }
        }
      } else {
        // This is a word
        tokens.push({ text: part, followedBy: 'none' });
        lastWasNewline = false;
      }
    }
  }, [text]);
  
  // Animation effect
  useEffect(() => {
    if (!isActive || tokens.length === 0) return;
    
    const revealNextToken = () => {
      if (visibleCount < tokens.length) {
        const newCount = visibleCount + 1;
        setVisibleCount(newCount);
        
        // Check if we've reached the threshold
        if (newCount === wordCountThreshold && onWordThresholdReached) {
          onWordThresholdReached();
        }
        
        // Handle auto-scrolling if enabled
        if (autoScroll && scrollViewRef?.current && textRef.current) {
          setTimeout(() => {
            textRef.current?.measureLayout(
              scrollViewRef.current as any,
              (x, y, width, height) => {
                scrollViewRef.current?.scrollTo({
                  y: y + height - 200,
                  animated: true
                });
              },
              () => console.log('Measurement failed')
            );
          }, 10);
        }
        
        // Schedule next token reveal if not at the end
        if (newCount < tokens.length) {
          timeoutRef.current = setTimeout(revealNextToken, speed);
        } else if (onComplete) {
          onComplete();
        }
      }
    };
    
    // Start the animation
    timeoutRef.current = setTimeout(revealNextToken, 0);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visibleCount, isActive, tokens.length, speed, onComplete, 
      autoScroll, scrollViewRef, wordCountThreshold, onWordThresholdReached]);
  
  // Render the text
  if (!isActive || visibleCount >= wordCountThreshold) {
    // Show the full original text when animation is disabled or threshold reached
    return <Text ref={textRef} style={style}>{text}</Text>;
  } else {
    // Show only the visible tokens during animation
    const visibleText = tokens.slice(0, visibleCount).map((token, index) => {
      if (token.text === '\n') return '\n';
      const needsSpace = token.followedBy === 'space' && 
                        index < visibleCount - 1 && // Don't add trailing space
                        tokens[index + 1].text !== '\n'; // Don't add space before newline
      return token.text + (needsSpace ? ' ' : '');
    }).join('');
    return <Text ref={textRef} style={style}>{visibleText}</Text>;
  }
};

export default WordByWordText;
