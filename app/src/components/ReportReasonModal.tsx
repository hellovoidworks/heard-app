import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Text, TextInput, Button, IconButton, Surface, useTheme } from 'react-native-paper';
import { fontNames } from '../utils/fonts';

interface ReportReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  contentType: 'letter' | 'thread';
}

const ReportReasonModal: React.FC<ReportReasonModalProps> = ({
  visible,
  onClose,
  onSubmit,
  contentType
}) => {
  const [reason, setReason] = useState('');
  const theme = useTheme();
  const inputRef = useRef<any>(null);
  
  // Focus the input when the modal becomes visible
  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
    }
  }, [visible]);

  const handleSubmit = () => {
    onSubmit(reason);
    setReason(''); // Reset the input after submission
  };

  const handleCancel = () => {
    setReason(''); // Reset the input when canceling
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        Keyboard.dismiss();
        handleCancel();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <Surface style={[styles.bottomModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: fontNames.interSemiBold }]}>Report {contentType === 'letter' ? 'Letter' : 'Conversation'}</Text>
              <IconButton
                icon="close"
                size={20}
                onPress={() => {
                  Keyboard.dismiss();
                  handleCancel();
                }}
                style={styles.closeButton}
              />
            </View>
            
            <Text style={[styles.subtitle, { fontFamily: fontNames.interRegular }]}>
              Please provide a reason for your report. This will help us review the content appropriately.
            </Text>
            
            <TextInput
              ref={inputRef}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for report..."
              placeholderTextColor={theme.colors.onSurfaceDisabled}
              multiline
              numberOfLines={6}
              mode="flat"
              style={styles.input}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              textColor={theme.colors.onSurface}
              selectionColor={theme.colors.primary}
              contentStyle={{
                backgroundColor: 'transparent',
                minHeight: 150,
                fontSize: 16,
                paddingHorizontal: 16,
                textAlignVertical: 'top',
                fontFamily: fontNames.interRegular
              }}
            />
            
            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={[styles.button, styles.cancelButton]}
                labelStyle={{ color: 'grey', fontFamily: fontNames.interMedium }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.button}
                disabled={!reason.trim()}
                labelStyle={{ fontFamily: fontNames.interMedium }}
              >
                Submit Report
              </Button>
            </View>
          </Surface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bottomModalContent: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    margin: -8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
    borderWidth: 0,
    borderRadius: 0,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 0,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    borderColor: 'gray',
  },
});

export default ReportReasonModal;
