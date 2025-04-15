import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
  Text,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Inter_700Bold } from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import eventEmitter, { EVENTS } from '../utils/eventEmitter';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STAR_SIZE = 50;
const INITIAL_STARS_COUNT = 10;
const STORAGE_KEY = '@heard_app/last_star_reward';

type StarProperties = {
  id: number;
  position: Animated.ValueXY;
  rotation: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
};

const StarRewardAnimation: React.FC = () => {
  // Check if fonts are loaded, but don't block rendering on them
  const [fontsLoaded] = useFonts({
    Inter_700Bold,
  });
  
  // Force a re-render when the component mounts to ensure it's active
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    console.log('StarRewardAnimation: Component mounted');
    setMounted(true);
    
    // Check for any pending rewards on mount
    const checkPendingRewards = async () => {
      try {
        const pendingRewardStr = await AsyncStorage.getItem('@heard_app/pending_star_reward');
        if (pendingRewardStr) {
          const pendingReward = parseInt(pendingRewardStr, 10);
          console.log('StarRewardAnimation: Found pending reward of', pendingReward, 'stars');
          if (pendingReward > 0) {
            // Clear the pending reward
            await AsyncStorage.removeItem('@heard_app/pending_star_reward');
            // Show the animation for the pending reward
            setRewardAmount(pendingReward);
            setVisible(true);
            showAnimation();
          }
        }
      } catch (error) {
        console.error('Error checking for pending rewards:', error);
      }
    };
    
    checkPendingRewards();
  }, []);
  
  // Track if animation is visible
  const [visible, setVisible] = useState(false);
  
  // Track the reward amount to display
  const [rewardAmount, setRewardAmount] = useState(0);
  
  // Timer reference for auto-dismissal
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const stars = useRef<StarProperties[]>([]);
  
  // Initialize stars with random positions
  useEffect(() => {
    stars.current = Array(INITIAL_STARS_COUNT).fill(0).map((_, index) => ({
      id: index,
      position: new Animated.ValueXY({
        x: Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2,
        y: Math.random() * SCREEN_HEIGHT - SCREEN_HEIGHT / 2,
      }),
      rotation: new Animated.Value(0),
      scale: new Animated.Value(0.1 + Math.random() * 0.5),
      opacity: new Animated.Value(0),
    }));
  }, []);

  // Get the user's profile for initial star count
  const { profile } = useAuth();
  
  // Initialize the last star count from profile
  useEffect(() => {
    const initializeLastStarCount = async () => {
      try {
        if (profile?.stars) {
          await AsyncStorage.setItem(STORAGE_KEY, profile.stars.toString());
        }
      } catch (error) {
        console.error('Error initializing star count in reward animation:', error);
      }
    };
    initializeLastStarCount();
  }, [profile]);

  // Listen for star reward events
  useEffect(() => {
    console.log('StarRewardAnimation: Setting up event listeners');
    
    // Listen for direct reward event
    const handleStarRewardEarned = (amount: number) => {
      console.log('StarRewardAnimation: STAR_REWARD_EARNED event received with amount:', amount);
      setRewardAmount(amount);
      // Force the visible state to true immediately
      setVisible(true);
      console.log('StarRewardAnimation: Set visible state to true directly');
      // Then call showAnimation to handle the animations
      console.log('StarRewardAnimation: About to show animation for', amount, 'stars');
      showAnimation();
      
      // Store the new count if profile exists
      if (profile?.stars) {
        AsyncStorage.setItem(STORAGE_KEY, profile.stars.toString())
          .catch(error => console.error('Error updating stored star count:', error));
      }
    };
    
    console.log('StarRewardAnimation: Subscribing to STAR_REWARD_EARNED event');
    eventEmitter.on(EVENTS.STAR_REWARD_EARNED, handleStarRewardEarned);
    
    // Clean up
    return () => {
      eventEmitter.off(EVENTS.STAR_REWARD_EARNED, handleStarRewardEarned);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [profile]);
  
  // Function to show the animation
  const showAnimation = () => {
    console.log('StarRewardAnimation: showAnimation called');
    
    // Reset animation values
    bounceAnim.setValue(0);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.3);
    
    // Clear any existing timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    
    // Make the animation visible - this ensures the state is set
    console.log('StarRewardAnimation: Setting visible state to true');
    setVisible(true);
    // Force an update to ensure the component re-renders
    setMounted(prev => !prev);
    console.log('StarRewardAnimation: Visible state set to true, animation should appear');
    
    // Animate stars
    stars.current.forEach((star, index) => {
      // Reset position
      star.position.setValue({
        x: 0,
        y: 0,
      });
      star.opacity.setValue(0);
      star.rotation.setValue(0);
      
      // Create random final destination
      const toX = (Math.random() * 2 - 1) * 150;
      const toY = (Math.random() * 2 - 1) * 150;
      
      // Create particle explosion animation
      Animated.sequence([
        // Delay based on index for staggered effect
        Animated.delay(index * 20),
        // Fade in
        Animated.timing(star.opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        // Explode outwards
        Animated.parallel([
          Animated.timing(star.position, {
            toValue: { x: toX, y: toY },
            duration: 1000,
            easing: Easing.out(Easing.back(1)),
            useNativeDriver: true,
          }),
          Animated.timing(star.rotation, {
            toValue: Math.random() * 6.28, // Random rotation (0-2PI)
            duration: 1000,
            useNativeDriver: true,
          }),
          // Fade out towards the end
          Animated.timing(star.opacity, {
            toValue: 0,
            duration: 800,
            delay: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
    
    // Animate the center reward text
    Animated.sequence([
      // Wait a bit for star explosion to start
      Animated.delay(100),
      // Fade in and bounce up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: -50,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Hold the animation (reduced from 2000ms to 1000ms)
      Animated.delay(1000),
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300, // Reduced from 500ms to 300ms
        useNativeDriver: true,
      }),
    ]).start();
    
    // Auto-dismiss after animation completes (reduced from 3000ms to 2000ms)
    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 2000);
  };
  
  // Handle manual dismiss
  const handleDismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    
    // Quickly fade out everything
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  };
  
  console.log('StarRewardAnimation: Rendering with visible:', visible, 'fontsLoaded:', fontsLoaded);
  // We don't want to block showing the animation if fonts aren't loaded
  // Only check if animation should be visible
  if (!visible) {
    console.log('StarRewardAnimation: Not rendering because not visible');
    return null;
  }
  console.log('StarRewardAnimation: Rendering modal with reward amount:', rewardAmount);
  
  return visible ? (
    <TouchableWithoutFeedback onPress={handleDismiss}>
      <View style={styles.container}>
        {/* Background dim */}
        <View style={styles.backdrop} />
        
        {/* Flying stars */}
        {stars.current.map((star) => (
          <Animated.View
            key={star.id}
            style={[
              styles.starContainer,
              {
                opacity: star.opacity,
                transform: [
                  { translateX: star.position.x },
                  { translateY: star.position.y },
                  { rotate: star.rotation.interpolate({
                    inputRange: [0, 6.28],
                    outputRange: ['0deg', '360deg'],
                  })},
                  { scale: star.scale },
                ],
              },
            ]}
          >
            <Ionicons name="star" size={STAR_SIZE} color="#FFD700" />
          </Animated.View>
        ))}
        
        {/* Center reward text */}
        <Animated.View
          style={[
            styles.rewardContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: bounceAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Display 1-5 stars based on reward amount */}
          <View style={styles.starsRow}>
            {[...Array(Math.min(rewardAmount, 5))].map((_, index) => (
              <Ionicons key={index} name="star" size={40} color="#FFD700" style={styles.rewardStar} />
            ))}
          </View>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  ) : null;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Ensure it's at the highest z-index
    elevation: 10, // For Android
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  starContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardContainer: {
    backgroundColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: 250,
  },
  rewardStar: {
    margin: 5,
  },
});

export default StarRewardAnimation;
