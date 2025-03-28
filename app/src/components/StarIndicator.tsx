import React, { useEffect, useRef, memo } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontNames } from '../utils/fonts';

/**
 * StarIndicator component that displays the user's star count with a shaking animation
 * when the count changes.
 */
const StarIndicator = memo(({ starCount }: { starCount: number }) => {
  // Create animated value for the shake animation
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const prevStarsRef = useRef(starCount);
  
  // Trigger shake animation when stars count changes
  useEffect(() => {
    if (prevStarsRef.current !== starCount) {
      // Start shake animation sequence
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 5, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -5, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      
      // Update previous stars reference
      prevStarsRef.current = starCount;
    }
  }, [starCount, shakeAnimation]);
  
  return (
    <Animated.View 
      style={[{ 
        backgroundColor: '#222222', 
        borderRadius: 20, 
        paddingHorizontal: 10, 
        paddingVertical: 5,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10
      }, {
        transform: [{ translateX: shakeAnimation }]
      }]}
    >
      <Text style={{ 
        color: 'white', 
        marginRight: 4,
        fontFamily: fontNames.interMedium,
        fontSize: 14
      }}>
        {starCount}
      </Text>
      <Ionicons name="star" size={16} color="#FFD700" />
    </Animated.View>
  );
});

export default StarIndicator;
