import React, { useEffect, useRef, memo, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontNames } from '../utils/fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import eventEmitter, { EVENTS } from '../utils/eventEmitter';

/**
 * StarIndicator component that displays the user's star count with a shaking animation
 * when the count changes.
 */
const LAST_STAR_COUNT_KEY = '@heard_app/last_star_count';

const StarIndicator = memo(({ starCount }: { starCount: number }) => {
  // Create animated value for the shake animation
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const prevStarsRef = useRef(starCount);
  const [initialized, setInitialized] = useState(false);
  
  // Function to trigger the shake animation
  const triggerShakeAnimation = () => {
    console.log('StarIndicator: Triggering shake animation');
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };
  
  // Initialize and listen for star update events
  useEffect(() => {
    const loadLastStarCount = async () => {
      try {
        const lastStarCountStr = await AsyncStorage.getItem(LAST_STAR_COUNT_KEY);
        const lastStarCount = lastStarCountStr ? parseInt(lastStarCountStr, 10) : null;
        
        // Save current star value as our reference
        await AsyncStorage.setItem(LAST_STAR_COUNT_KEY, starCount.toString());
        prevStarsRef.current = starCount;
        setInitialized(true);
      } catch (error: unknown) {
        console.error('Error loading last star count:', error);
        setInitialized(true);
      }
    };
    
    loadLastStarCount();
    
    // Listen for star update events
    const handleStarsUpdated = (newStarCount: number) => {
      console.log('StarIndicator: Stars updated event received', newStarCount, prevStarsRef.current);
      if (prevStarsRef.current !== newStarCount) {
        triggerShakeAnimation();
        
        // Update our stored reference
        AsyncStorage.setItem(LAST_STAR_COUNT_KEY, newStarCount.toString())
          .catch((error: unknown) => console.error('Error saving star count:', error));
        
        // Update previous stars reference
        prevStarsRef.current = newStarCount;
      }
    };
    
    // Subscribe to star update events
    eventEmitter.on(EVENTS.STARS_UPDATED, handleStarsUpdated);
    
    // Cleanup
    return () => {
      eventEmitter.off(EVENTS.STARS_UPDATED, handleStarsUpdated);
    };
  }, []);
  
  // Handle regular prop updates (for cases where the component doesn't unmount)
  useEffect(() => {
    if (initialized && prevStarsRef.current !== starCount) {
      console.log('StarIndicator: Star count prop changed', starCount, prevStarsRef.current);
      triggerShakeAnimation();
      prevStarsRef.current = starCount;
    }
  }, [starCount, initialized]);
  
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
