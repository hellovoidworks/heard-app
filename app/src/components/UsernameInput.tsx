import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';

interface UsernameInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  style?: any;
}

const UsernameInput: React.FC<UsernameInputProps> = ({
  value,
  onChangeText,
  label = 'Username',
  error,
  style,
}) => {

  return (
    <View style={[styles.container, style]}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        error={!!error}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
});

export default UsernameInput;
