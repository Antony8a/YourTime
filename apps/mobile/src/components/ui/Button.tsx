import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  className?: string;
  style?: any;
}

export const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  className = '',
  style,
}: ButtonProps) => {
  const colorScheme = useColorScheme();

  const baseStyle = styles.base;
  const variantStyles = {
    primary: styles.primary,
    secondary: styles.secondary,
    outline: styles.outline,
    ghost: styles.ghost,
    danger: styles.danger,
  }[variant];

  const combinedStyle = [baseStyle, variantStyles, style, className && styles[className]].filter(Boolean);

  return (
    <TouchableOpacity
      style={combinedStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <View style={styles.spinnerContainer}>
          <Spinner size="small" color="white" />
        </View>
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minHeight: 48,
  },
  primary: {
    backgroundColor: '#3B82F6',
  },
  secondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: '#EF4444',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});