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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
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

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: 'heardapp://auth/callback',
        },
      });
      
      if (error) throw error;
      
      console.log('Magic link sent successfully');
      setMagicLinkSent(true);
    } catch (error: any) {
      console.error('Error sending magic link:', error);
      Alert.alert('Error', error.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const openMailApp = async () => {
    try {
      // Try to open the default mail app
      let url = '';
      
      if (Platform.OS === 'ios') {
        url = 'message://';
      } else {
        url = 'mailto:';
      }
      
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // If can't open mail app, try Gmail
        const gmailUrl = 'googlegmail://';
        const canOpenGmail = await Linking.canOpenURL(gmailUrl);
        
        if (canOpenGmail) {
          await Linking.openURL(gmailUrl);
        } else {
          Alert.alert('Error', 'Could not open mail app');
        }
      }
    } catch (error) {
      console.error('Error opening mail app:', error);
      Alert.alert('Error', 'Could not open mail app');
    }
  };

  const handleBackToSignIn = () => {
    setMagicLinkSent(false);
    setEmail('');
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
            <View style={styles.mottoContainer}>
              <View style={styles.taglineRow}>
                <Image source={require('../../assets/main-1.png')} style={styles.heartIcon} />
                <Text style={styles.taglineText}>Write.</Text>
              </View>
              <Text style={styles.taglineText}>Read.</Text>
              <Text style={styles.taglineText}>Connect.</Text>
              <Text style={styles.subtitleText}>
                A safe space for{'\n'}real connections
              </Text>
            </View>

            <View style={styles.decorativeChips}>
              <View style={[styles.chip, { backgroundColor: '#FF7EB0', transform: [{ rotate: '-8deg' }] }]}>
                <Text style={styles.chipText}>LOVE</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: '#FFB546', right: 30, top: -40 }]}>
                <Text style={styles.chipText}>HEALTH</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: '#5B9DFF', top: -30, right: -50 }]}>
                <Text style={styles.chipText}>WORK</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: '#FF6B5B', left: 50 }]}>
                <Text style={styles.chipText}>VENT</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: '#E2CB53', bottom: 30, right: -80 }]}>
                <Text style={styles.chipText}>GOOD VIBES</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: '#E27953', bottom: 0, left: 40 }]}>
                <Text style={styles.chipText}>LIFE</Text>
              </View>
              <Image source={require('../../assets/main-1.png')} style={[styles.emoji, { right: 40, top: 80 }]} />
              <Image source={require('../../assets/main-1.png')} style={[styles.emoji, { left: 30, bottom: 40 }]} />
              <Image source={require('../../assets/main-1.png')} style={[styles.emoji, { right: 20, bottom: 10 }]} />
            </View>

            {magicLinkSent ? (
              <View style={styles.magicLinkSentContainer}>
                <Text style={styles.magicLinkText}>
                  Magic link sent! Check your email at {email} and click the link to sign in.
                </Text>
                
                <Button
                  mode="contained"
                  onPress={openMailApp}
                  style={styles.mailButton}
                  icon="email"
                >
                  Open Mail App
                </Button>
                
                <Button
                  mode="text"
                  onPress={handleBackToSignIn}
                  style={styles.backButton}
                  textColor="#FFFFFF"
                >
                  Back to Sign In
                </Button>
              </View>
            ) : (
              <>
                {!showEmailInput ? (
                  <View style={styles.buttonsContainer}>
                    {appleAuthAvailable && (
                      <TouchableOpacity 
                        style={styles.appleButtonContainer}
                        onPress={handleSignInWithApple}
                        disabled={loading}
                      >
                        <AppleAuthentication.AppleAuthenticationButton
                          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                          cornerRadius={28}
                          style={styles.appleButton}
                          onPress={handleSignInWithApple}
                        />
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={styles.emailButtonContainer}
                      onPress={() => setShowEmailInput(true)}
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
                ) : (
                  <>
                    <Text style={styles.emailInstructions}>
                      Enter your email address and we'll send you a magic link to sign in.
                    </Text>
                    
                    <TextInput
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      disabled={loading}
                    />
                    
                    <Button
                      mode="contained"
                      onPress={handleSendMagicLink}
                      style={styles.button}
                      loading={loading}
                      disabled={loading || !email.trim()}
                    >
                      Send Magic Link
                    </Button>
                    
                    <Button
                      mode="text"
                      onPress={() => setShowEmailInput(false)}
                      style={styles.backButton}
                      textColor="#FFFFFF"
                    >
                      Back
                    </Button>
                  </>
                )}
              </>
            )}
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
  mottoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  taglineText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 60,
  },
  subtitleText: {
    color: '#777777',
    fontSize: 24,
    textAlign: 'center',
    marginTop: 10,
  },
  decorativeChips: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  chip: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emoji: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 60,
    alignItems: 'center',
  },
  appleButtonContainer: {
    width: '100%',
    height: 56,
    marginBottom: 16,
    borderRadius: 28,
    overflow: 'hidden',
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  emailButtonContainer: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
  emailButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#333333',
    color: '#FFFFFF',
    borderRadius: 8,
  },
  button: {
    width: '100%',
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 28,
  },
  magicLinkSentContainer: {
    alignItems: 'center',
    width: '100%',
  },
  magicLinkText: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  mailButton: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 6,
    borderRadius: 28,
  },
  backButton: {
    marginTop: 8,
  },
  emailInstructions: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});

export default LoginScreen; 