import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontNames } from '../utils/fonts';

const ContactUsScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleSendEmail = () => {
    const subject = encodeURIComponent('Feedback regarding Heard App');
    const emailAddress = 'hello@voidworks.co';
    const mailtoUrl = `mailto:${emailAddress}?subject=${subject}`;
    
    Linking.canOpenURL(mailtoUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(mailtoUrl);
        } else {
          console.log('Cannot open email client');
        }
      })
      .catch((err) => console.error('Error opening email client:', err));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.contentContainer}>
        <Text style={[styles.header, { color: theme.colors.onSurface }]}>
          Contact Us
        </Text>
        
        <Text style={[styles.message, { color: theme.colors.onSurface }]}>
          If you have any feedback or want to report inappropriate activity, please send us an email at
        </Text>
        
        <TouchableOpacity onPress={handleSendEmail}>
          <Text style={styles.emailLink}>
            hello@voidworks.co
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  header: {
    fontSize: 22,
    fontFamily: fontNames.interBold,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: fontNames.interRegular,
  },
  emailLink: {
    fontSize: 16,
    color: '#9292FF',
    textDecorationLine: 'underline',
    fontFamily: fontNames.interMedium,
    marginTop: 8,
  },
});

export default ContactUsScreen;
