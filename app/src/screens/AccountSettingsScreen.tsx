import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput as RNTextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const DeleteAccountScreen = () => {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Handle delete button press
  const handleDeleteButtonPress = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setShowDeleteConfirm(true),
        },
      ]
    );
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      Alert.alert('Error', 'Please type "delete" to confirm');
      return;
    }

    setDeletingAccount(true);
    try {
      if (!user) {
        throw new Error('No user found');
      }

      // Delete the user using the RPC function
      // This runs server-side with appropriate permissions and will trigger our CASCADE rules
      const { error } = await supabase.rpc('delete_user');
      
      if (error) {
        throw error;
      }

      // Sign out after deletion
      await signOut();
      
      // No need to navigate as signOut will redirect to login
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', error.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </Text>
        
        <Button 
          mode="contained" 
          onPress={handleDeleteButtonPress}
          style={styles.deleteButton}
          buttonColor="red"
          icon="account-remove"
        >
          Delete My Account
        </Button>
      </View>
    </ScrollView>
    
    {/* Delete Account Confirmation Dialog */}
    {showDeleteConfirm && (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }]}
      >
        <View style={{ backgroundColor: theme.colors.background, padding: 20, borderRadius: 8, width: '100%', maxWidth: 400 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: theme.colors.onSurface }}>Confirm Account Deletion</Text>
          <Text style={{ marginBottom: 16, color: theme.colors.onSurface }}>This action cannot be undone. All your data will be permanently deleted. Type <Text style={{ fontWeight: 'bold' }}>delete</Text> to confirm.</Text>
          
          <RNTextInput
            style={{ 
              borderWidth: 1, 
              borderColor: theme.colors.outline, 
              borderRadius: 4, 
              padding: 10, 
              marginBottom: 16,
              color: theme.colors.onSurface
            }}
            placeholder="Type 'delete' to confirm"
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            autoCapitalize="none"
          />
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button 
              mode="text" 
              onPress={() => {
                Keyboard.dismiss();
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
              }}
              style={{ marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={() => {
                Keyboard.dismiss();
                handleDeleteAccount();
              }}
              loading={deletingAccount}
              disabled={deletingAccount || deleteConfirmText.toLowerCase() !== 'delete'}
              buttonColor="red"
            >
              Delete Forever
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 24,
    marginTop: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteButton: {
    width: '100%',
    marginTop: 16,
  },
});

export default DeleteAccountScreen; 