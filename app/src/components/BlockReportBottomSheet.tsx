import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import ReportReasonModal from './ReportReasonModal';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RBSheet from 'react-native-raw-bottom-sheet';

export interface BlockReportBottomSheetProps {
  onBlock: () => void;
  onReport: (reason?: string) => void;
  contentType: 'letter' | 'thread';
}

export interface BlockReportBottomSheetRef {
  open: () => void;
  close: () => void;
}

const BlockReportBottomSheet = forwardRef<BlockReportBottomSheetRef, BlockReportBottomSheetProps>(
  ({ onBlock, onReport, contentType }, ref) => {
    const rbSheetRef = useRef<any>(null);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);

    // Expose the open and close methods to the parent component
    useImperativeHandle(ref, () => ({
      open: () => {
        rbSheetRef.current?.open();
      },
      close: () => {
        rbSheetRef.current?.close();
      }
    }));

    return (
      <>
        <RBSheet
          ref={rbSheetRef}
          height={220}
          openDuration={250}
          customStyles={{
            wrapper: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)'
            },
            container: {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            },
            draggableIcon: {
              backgroundColor: '#FFFFFF50',
              width: 60
            }
          }}
        >
          <View style={styles.bottomSheetContent}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurfaceVariant }]}>Options</Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={onBlock}
              >
                <Text style={{ color: '#FF3B30', fontSize: 16, textAlign: 'center' }}>Block User</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  rbSheetRef.current?.close();
                  // Show report reason modal
                  setTimeout(() => {
                    setReportReasonModalVisible(true);
                  }, 300); // Add delay to ensure bottom sheet is closed first
                }}
              >
                <Text style={{ color: theme.colors.primary, fontSize: 16, textAlign: 'center' }}>Report Content</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RBSheet>
        
        <ReportReasonModal
          visible={reportReasonModalVisible}
          onClose={() => setReportReasonModalVisible(false)}
          onSubmit={(reason) => {
            setReportReasonModalVisible(false);
            onReport(reason);
          }}
          contentType={contentType}
        />
      </>
    );
  }
);

const styles = StyleSheet.create({
  bottomSheetContent: {
    padding: 16,
    flex: 1,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center'
  },
  optionItem: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center'
  }
});

export default BlockReportBottomSheet;
