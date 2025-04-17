import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking, Image, StatusBar, FlatList, NativeSyntheticEvent, NativeScrollEvent, Dimensions } from 'react-native';
import { fontNames } from '../../utils/fonts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Title, Divider, IconButton, useTheme } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../services/supabase';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = React.useRef<FlatList<any>>(null);
  const theme = useTheme();

  // Check if Apple authentication is available on this device
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      setAppleAuthAvailable(isAvailable);
    };
    
    checkAppleAuthAvailability();
  }, []);

  const handleSignInWithApple = async () => {
    try {
      setLoading(true);
      
      // Generate a random nonce
      const rawNonce = Array.from(
        { length: 32 },
        () => Math.floor(Math.random() * 36).toString(36)
      ).join('');
      
      // Hash the nonce
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      
      // Use the credential.identityToken to sign in with Supabase
      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });
        
        if (error) throw error;
        
        // If successful, update the auth context
        if (data?.user) {
          // Profile will be automatically created by the database trigger
          signIn(data.user);
        }
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('Error', error.message || 'An error occurred during Apple sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = () => {
    navigation.navigate('EmailSignIn');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#161616' }]} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#161616" />
      <View style={styles.mainContainer}>
        {/* Carousel at the top */}
        <View style={styles.carouselContainer}>
          <FlatList
            data={[
              {
                image: require('../../assets/home-1.png'),
                title: 'Express freely, annonymously.',
                description: 'Let it out. Share authentic, unfiltered stories without giving yourself away.'
              },
              {
                image: require('../../assets/home-2.png'),
                title: 'Keep it real,\njust between you two.',
                description: 'Open up, link up, and stir up a little magic — no judgment, just real vibes.'
              }
            ]}
            keyExtractor={(_: any, idx: number) => idx.toString()}
            renderItem={({ item }: { item: { image: any; title: string; description: string } }) => (
              <View style={styles.slide}>
                <Image source={item.image} style={styles.slideImage} />
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideDescription}>{item.description}</Text>
              </View>
            )}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
              setCarouselIndex(index);
            }}
            ref={carouselRef}
          />
          {/* Dot indicator */}
          <View style={styles.dotContainer}>
            {[0,1].map(i => (
              <View key={i} style={[styles.dot, carouselIndex === i && styles.dotActive]} />
            ))}
          </View>
        </View>
        
        {/* Buttons at the bottom */}
        <View style={styles.buttonsContainer}>
          {appleAuthAvailable && (
            <TouchableOpacity 
              style={styles.appleButtonContainer}
              disabled={loading}
              onPress={handleSignInWithApple}
              accessibilityLabel="Sign in with Apple"
              activeOpacity={0.8}
            >
              <View style={styles.customAppleButton}>
                <Image
                  source={require('../../assets/apple-logo.png')}
                  style={styles.appleLogo}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </View>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.emailButtonContainer}
            onPress={handleEmailSignIn}
            disabled={loading}
          >
            <LinearGradient
              colors={['#62DDD2', '#9292FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.emailButtonText}>Sign in with Email</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161616',
  },
  mainContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    justifyContent: 'space-between',
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 0,
    width: '100%',
  },
  slide: {
    width: Dimensions.get('window').width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  slideImage: {
    width: Dimensions.get('window').width * 0.85,
    maxWidth: 420,
    maxHeight: 430,
    marginBottom: 15,
    resizeMode: 'contain',
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: fontNames.interBold,
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
    maxWidth: 310,
  },
  slideDescription: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 5,
    lineHeight: 22,
    maxWidth: 310,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -5,
    marginBottom: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
    marginHorizontal: 5,
  },
  dotActive: {
    backgroundColor: '#476EF1', // App's primary color
    width: 16,
  },
  buttonsContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 8, // further reduced
    alignItems: 'center',
    marginTop: 32, // shift lower
  },
  appleButtonContainer: {
    width: '100%',
    height: 48, // further reduced
    marginBottom: 8, // further reduced
    borderRadius: 24,
    overflow: 'hidden',
  },
  customAppleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    width: '100%',
    height: 48,
  },
  appleLogo: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  appleButtonText: {
    color: '#222',
    fontSize: 17,
    fontWeight: 'bold',
    fontFamily: fontNames.interBold,
    letterSpacing: 0.2,
  },
  emailButtonContainer: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    padding: 10,
  },
  emailButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    fontFamily: fontNames.interBold,
    backgroundColor: 'transparent',
  },
});

export default LoginScreen; 