import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: any;
}

const variantColors = {
  primary: { bg: 'primary.100', text: 'primary.700', border: 'primary.200' },
  secondary: { bg: 'gray.100', text: 'gray.700', border: 'gray.200' },
  success: { bg: 'success.50', text: 'success.700', border: 'success.100' },
  warning: { bg: 'warning.50', text: 'warning.700', border: 'warning.100' },
  error: { bg: 'error.50', text: 'error.700', border: 'error.100' },
  outline: { bg: 'transparent', text: 'gray.700', border: 'gray.300' },
};

const darkColors = {
  primary: { bg: 'primary.900/30', text: 'primary.300', border: 'primary.800' },
  secondary: { bg: 'gray.800', text: 'gray.300', border: 'gray.700' },
  success: { bg: 'success.900/30', text: 'success.300', border: 'success.800' },
  warning: { bg: 'warning.900/30', text: 'warning.300', border: 'warning.800' },
  error: { bg: 'error.900/30', text: 'error.300', border: 'error.800' },
  outline: { bg: 'transparent', text: 'gray.300', border: 'gray.600' },
};

export const Badge = ({ children, variant = 'primary', size = 'md', className = '', style }: BadgeProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors[variant] : variantColors[variant];

  const sizeStyles = {
    sm: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, borderRadius: 4 },
    md: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, borderRadius: 9999 },
    lg: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, borderRadius: 9999 },
  }[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: colors.border,
        },
        sizeStyles,
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.text }, style]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});