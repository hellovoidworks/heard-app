import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Animated } from 'react-native';

type AnimationType = 'shake' | 'bounce' | 'spin' | 'pulse' | 'pop' | 'random';

interface AnimatedEmojiProps {
  emoji: string;
  animation?: AnimationType;
  size?: number;
  visible: boolean;
  onAnimationComplete?: () => void;
  duration?: number;
  showOverlay?: boolean;
  overlayColor?: string;
  style?: any;
}

const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({
  emoji,
  animation = 'random',
  size = 90,
  visible,
  onAnimationComplete,
  duration = 750,
  showOverlay = true,
  overlayColor = 'rgba(0, 0, 0, 0.5)',
  style
}) => {
  const [currentAnimation, setCurrentAnimation] = useState<string>('shake');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[AnimatedEmoji] Props received:', { emoji, visible, animation });
    
    if (visible) {
      // Reset all animations
      shakeAnim.setValue(0);
      scaleAnim.setValue(0);
      bounceAnim.setValue(0);
      rotateAnim.setValue(0);
      pulseAnim.setValue(0);
      
      // Choose animation type
      let animationType = animation;
      if (animation === 'random') {
        const animations = ['shake', 'bounce', 'spin', 'pulse', 'pop'];
        animationType = animations[Math.floor(Math.random() * animations.length)] as AnimationType;
      }
      
      setCurrentAnimation(animationType);
      
      // Run the selected animation
      let animationSequence;
      
      switch (animationType) {
        case 'shake':
          // Shaking animation
          animationSequence = Animated.parallel([
            // Quick pop-in scale animation
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // Shaking animation sequence
            Animated.sequence([
              Animated.delay(100),
              Animated.loop(
                Animated.sequence([
                  Animated.timing(shakeAnim, {
                    toValue: 1,
                    duration: 50,
                    useNativeDriver: true,
                  }),
                  Animated.timing(shakeAnim, {
                    toValue: -1,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(shakeAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(shakeAnim, {
                    toValue: 0,
                    duration: 50,
                    useNativeDriver: true,
                  }),
                ]),
                { iterations: 2 }
              )
            ])
          ]);
          break;
          
        case 'bounce':
          // Bouncing animation
          animationSequence = Animated.sequence([
            // Initial scale up
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // Bounce sequence
            Animated.parallel([
              // Vertical bounce
              Animated.sequence([
                // First bounce up
                Animated.timing(bounceAnim, {
                  toValue: 1,
                  duration: 150,
                  useNativeDriver: true,
                }),
                // Down and up with spring physics
                Animated.spring(bounceAnim, {
                  toValue: 0,
                  friction: 3,
                  tension: 40,
                  useNativeDriver: true,
                })
              ])
            ])
          ]);
          break;
          
        case 'spin':
          // Spinning animation
          animationSequence = Animated.sequence([
            // Initial scale up
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // Spin around
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            })
          ]);
          break;
          
        case 'pulse':
          // Pulsing animation
          animationSequence = Animated.sequence([
            // Initial appear
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            // Pulse sequence
            Animated.loop(
              Animated.sequence([
                // Pulse out
                Animated.timing(pulseAnim, {
                  toValue: 1,
                  duration: 150,
                  useNativeDriver: true,
                }),
                // Pulse in
                Animated.timing(pulseAnim, {
                  toValue: 0,
                  duration: 150,
                  useNativeDriver: true,
                })
              ]),
              { iterations: 2 }
            )
          ]);
          break;
          
        case 'pop':
        default:
          // Pop animation
          animationSequence = Animated.sequence([
            // Quick pop in
            Animated.spring(scaleAnim, {
              toValue: 1.05, // Reduced by 25% from 1.4
              friction: 3,
              tension: 40,
              useNativeDriver: true,
            }),
            // Settle to normal size
            Animated.spring(scaleAnim, {
              toValue: 0.9, // Reduced by 25% from 1.0
              friction: 3,
              tension: 40,
              useNativeDriver: true,
            })
          ]);
          break;
      }
      
      // Start animation and call onAnimationComplete when done
      animationSequence.start(() => {
        if (onAnimationComplete) {
          // Add a small delay to ensure animation is visually complete
          setTimeout(onAnimationComplete, duration - 100);
        }
      });
    }
  }, [visible, animation]);

  if (!visible) return null;

  return (
    <View style={[styles.emojiDisplayContainer, style]}>
      {showOverlay && <View style={[styles.emojiOverlay, { backgroundColor: overlayColor }]} />}
      <Animated.Text 
        style={[
          styles.largeEmoji,
          { fontSize: size },
          {
            transform: [
              // Base scale transform for all animations
              {
                scale: scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.9] // Reduced by 25% from 1.2
                })
              },
              // Animation-specific transforms
              ...(currentAnimation === 'shake' ? [
                // X-position transform (side to side shake)
                {
                  translateX: shakeAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-20, 0, 20] // Shake left and right
                  })
                },
                // Small rotation for more dynamic shake
                {
                  rotate: shakeAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ['-10deg', '0deg', '10deg']
                  })
                }
              ] : []),
              
              ...(currentAnimation === 'bounce' ? [
                // Y-position transform (up and down bounce)
                {
                  translateY: bounceAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, -60, -30] // Bounce up and down
                  })
                },
                // Extra scale for bounce
                {
                  scale: bounceAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.9, 1.05, 0.9] // Reduced by 25% from [1.2, 1.4, 1.2]
                  })
                }
              ] : []),
              
              ...(currentAnimation === 'spin' ? [
                // Rotation transform
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'] // Full rotation
                  })
                }
              ] : []),
              
              ...(currentAnimation === 'pulse' ? [
                // Pulsing scale
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.13] // Reduced by 25% from [1.2, 1.5]
                  })
                }
              ] : []),
              
              ...(currentAnimation === 'pop' ? [
                // Pop is handled by the base scale animation
              ] : [])
            ]
          }
        ]}
      >
        {emoji}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emojiDisplayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  emojiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  largeEmoji: {
    marginBottom: 20,
    zIndex: 1000,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5, // Add shadow for better visibility
  },
});

export default AnimatedEmoji;
