import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking, Image, StatusBar, SafeAreaView } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
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
    <SafeAreaView style={[styles.container, { backgroundColor: '#121212' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {!magicLinkSent ? (
              <>
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
                        borderBottomColor: email ? (isValidEmail ? theme.colors.primary : '#FF5252') : 'transparent',
                        borderBottomWidth: email ? 1 : 0,
                      }]}
                      maxLength={100}
                      theme={{ colors: { text: theme.colors.onSurface, primary: 'transparent' } }}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      mode="flat"
                      dense
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoFocus
                    />
                    {email && !isValidEmail && (
                      <Text style={styles.errorText}>Please enter a valid email address</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.divider} />
                
                <Button
                  mode="contained"
                  onPress={handleSendMagicLink}
                  style={styles.button}
                  loading={loading}
                  disabled={loading || !email.trim() || !isValidEmail}
                  labelStyle={styles.buttonLabelStyle}
                >
                  Send Magic Link
                </Button>
              </>
            ) : (
              <View style={styles.magicLinkSentContainer}>
                <Text style={styles.title}>Magic Link Sent</Text>
                
                <Text style={styles.magicLinkText}>
                  Magic link sent! Check your email at {email} and click the link to sign in.
                </Text>
                
                <Button
                  mode="contained"
                  onPress={openMailApp}
                  style={styles.mailButton}
                  icon="email"
                  labelStyle={styles.buttonLabelStyle}
                >
                  Open Mail App
                </Button>
                
                <Button
                  mode="text"
                  onPress={handleBack}
                  textColor="#FFFFFF"
                >
                  Go Back
                </Button>
              </View>
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
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  content: {
    padding: 20,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
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