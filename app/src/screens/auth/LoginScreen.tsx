import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking, Image, StatusBar, SafeAreaView } from 'react-native';
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
    <SafeAreaView style={[styles.container, { backgroundColor: '#121212' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/logo.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
          </View>

          <View style={styles.content}>
            <View style={styles.mainImageContainer}>
              <Image 
                source={require('../../assets/main-1.png')} 
                style={styles.mainImage} 
                resizeMode="contain"
              />
            </View>

            <View style={styles.buttonsContainer}>
              {appleAuthAvailable && (
                <TouchableOpacity 
                  style={styles.appleButtonContainer}
                  disabled={loading}
                >
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={30}
                    style={styles.appleButton}
                    onPress={handleSignInWithApple}
                  />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 250,
    height: 100,
  },
  content: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  mainImageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  mainImage: {
    width: '100%',
    height: 300,
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 60,
    alignItems: 'center',
  },
  appleButtonContainer: {
    width: '100%',
    height: 60,
    marginBottom: 16,
    borderRadius: 30,
    overflow: 'hidden',
  },
  appleButton: {
    width: '100%',
    height: 60,
  },
  emailButtonContainer: {
    width: '100%',
    height: 60,
    borderRadius: 30,
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
    borderRadius: 30,
    padding: 15,
  },
  emailButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
});

export default LoginScreen; 