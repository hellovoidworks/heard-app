import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, useTheme } from 'react-native-paper';

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
}: LabeledTextInputProps) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[
        styles.label, 
        { color: theme.colors.onBackground },
        labelStyle
      ]}>
        {label}{required ? ' (Required)' : ''}
      </Text>
      
      <TextInput
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
  multilineInput: {
    minHeight: 100,
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
  },
});

export default LabeledTextInput;
