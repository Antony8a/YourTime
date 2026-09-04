import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  style?: any;
}

export const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  required = false,
  error,
  disabled = false,
  className = '',
  style,
}: InputProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, className && styles[className], style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
        </View>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, isDark ? styles.inputDark : styles.inputLight, error && styles.inputError, disabled && styles.inputDisabled, style]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          disabled={disabled}
          placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  required: {
    color: '#EF4444',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputDark: {
    backgroundColor: '#374151',
    color: '#F9FAFB',
  },
  inputLight: {
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#EF4444',
  },
});