import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput as PaperTextInput, useTheme } from 'react-native-paper';

interface LabeledTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  required?: boolean;
  containerStyle?: object;
  inputStyle?: object;
  labelStyle?: object;
  hintStyle?: object;
  layout?: 'vertical' | 'horizontal';
  labelWidth?: string | number;
  mode?: 'flat' | 'outlined';
  dense?: boolean;
}

const LabeledTextInput = ({
  label,
  value,
  onChangeText,
  placeholder = '',
  hint = '',
  maxLength,
  multiline = false,
  numberOfLines = 1,
  required = false,
  containerStyle = {},
  inputStyle = {},
  labelStyle = {},
  hintStyle = {},
  layout = 'vertical',
  labelWidth = '22%',
  mode = 'outlined',
  dense = false,
}: LabeledTextInputProps) => {
  const theme = useTheme();

  // Horizontal layout (side-by-side label and input)
  if (layout === 'horizontal') {
    return (
      <View style={[styles.horizontalContainer, containerStyle]}>
        <Text style={[
          styles.horizontalLabel, 
          { color: theme.colors.onBackground, width: labelWidth },
          labelStyle
        ]}>
          {label}{required ? ' (Required)' : ''}
        </Text>
        
        <View style={styles.inputWrapper}>
          <PaperTextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.onSurfaceDisabled}
            multiline={multiline}
            numberOfLines={numberOfLines}
            style={[
              styles.horizontalInput, 
              { 
                backgroundColor: 'transparent',
                color: theme.colors.onSurface
              },
              multiline && styles.multilineInput,
              inputStyle
            ]}
            maxLength={maxLength}
            theme={{ colors: { text: theme.colors.onSurface, primary: 'white' } }}
            selectionColor="white"
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            mode="flat"
            dense={dense}
          />
          
          {hint ? (
            <Text style={[
              styles.hint, 
              { color: theme.colors.onSurfaceDisabled },
              hintStyle
            ]}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }
  
  // Vertical layout (default)
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[
        styles.label, 
        { color: theme.colors.onBackground },
        labelStyle
      ]}>
        {label}{required ? ' (Required)' : ''}
      </Text>
      
      <PaperTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceDisabled}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[
          styles.input, 
          { 
            backgroundColor: theme.colors.surface,
            color: theme.colors.onSurface
          },
          multiline && styles.multilineInput,
          inputStyle
        ]}
        maxLength={maxLength}
        theme={{ colors: { text: theme.colors.onSurface } }}
        mode={mode}
        dense={dense}
      />
      
      {hint ? (
        <Text style={[
          styles.hint, 
          { color: theme.colors.onSurfaceDisabled },
          hintStyle
        ]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // Vertical layout styles
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    marginBottom: 8,
  },
  
  // Horizontal layout styles
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 8,
  },
  horizontalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    paddingTop: 8,
  },
  inputWrapper: {
    flex: 1,
    marginTop: -2,
  },
  horizontalInput: {
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 40,
  },
  
  // Shared styles
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
  },
});

export default LabeledTextInput;
