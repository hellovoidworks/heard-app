import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking, Image, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, Button, Text, useTheme, IconButton } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailSignIn'>;

const EmailSignInScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isValidEmail, setIsValidEmail] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Validate email whenever it changes
  useEffect(() => {
    validateEmail(email);
  }, [email]);

  // Simple email validation function
  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(text));
  };

  const handleSendMagicLink = async () => {
    if (!email.trim() || !isValidEmail) {
      Alert.alert('Error', 'Please enter a valid email address');
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

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#121212' }]} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={styles.mainContainer}>
          {/* Header with back button */}
          <View style={[styles.header, { marginTop: insets.top > 0 ? insets.top + 16 : 32 }]}>
            <IconButton
              icon="arrow-left"
              size={24}
              onPress={handleBack}
              iconColor={theme.colors.onBackground}
            />
          </View>

          {/* Main content */}
          <View style={styles.content}>
            {!magicLinkSent ? (
              <>
                <Text style={styles.emailIcon}>✉️</Text>
                <Text style={styles.title}>Sign in with Email</Text>
                
                <Text style={styles.emailInstructions}>
                  Enter your email address and we'll send you a magic link to sign in.
                </Text>
                
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabel, { color: theme.colors.onBackground }]}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email address"
                      placeholderTextColor={theme.colors.onSurfaceDisabled}
                      style={[styles.emailInput, { 
                        backgroundColor: 'transparent', 
                        color: theme.colors.onSurface,
                        borderBottomWidth: 0, // Remove border bottom entirely
                      }]}
                      maxLength={100}
                      theme={{ colors: { text: theme.colors.onSurface, primary: 'white' } }}
                      selectionColor="white"
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      mode="flat"
                      dense
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoFocus
                    />
                  </View>
                </View>
                
                <View style={styles.divider} />
                
                <Button
                  mode="contained"
                  onPress={handleSendMagicLink}
                  style={[styles.button, { marginTop: 24 }]}
                  loading={loading}
                  disabled={loading || !email.trim() || !isValidEmail}
                  labelStyle={styles.buttonLabelStyle}
                >
                  Send Magic Link
                </Button>
              </>
            ) : (
              <View style={styles.magicLinkSentContainer}>
                <Text style={styles.emailIcon}>🔗</Text>
                <Text style={styles.title}>Magic Link Sent</Text>
                
                <Text style={styles.magicLinkText}>
                  Magic link sent! Check your email at {email} and click the button to sign in.
                </Text>
                
                <Button
                  mode="contained"
                  onPress={openMailApp}
                  style={styles.mailButton}
                  labelStyle={styles.buttonLabelStyle}
                >
                  Open Mail App
                </Button>
              </View>
            )}
          </View>
          
          {/* Empty view to push content up when keyboard appears */}
          <View style={styles.spacer} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
  },
  spacer: {
    height: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  content: {
    padding: 20,
    flex: 1,
  },
  emailIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8, // Reduced from 16 to move title higher
  },
  title: {
    fontSize: 28,
    fontWeight: '900', // Increased from 'bold' to make it bolder
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
  },
  emailInstructions: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    width: '22%',
    marginRight: 8,
    paddingTop: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  emailInput: {
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 40,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 24,
    display: 'none',
  },
  input: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#333333',
    color: '#FFFFFF',
    borderRadius: 8,
  },
  button: {
    width: '100%',
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
  buttonLabelStyle: {
    fontSize: 18,
  },
});

export default EmailSignInScreen; 