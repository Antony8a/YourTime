import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, TOUCH_TARGET } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the full width of the parent. */
  block?: boolean;
  size?: 'md' | 'sm';
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  block = false,
  size = 'md',
  style,
}: ButtonProps) {
  const { colors, shadow } = useTheme();
  const inactive = disabled || loading;

  const palette = {
    primary: {
      bg: colors.primary,
      pressed: colors.primaryPressed,
      fg: colors.onPrimary,
      border: 'transparent',
    },
    secondary: {
      bg: colors.surface,
      pressed: colors.surfaceMuted,
      fg: colors.text,
      border: colors.border,
    },
    ghost: {
      bg: 'transparent',
      pressed: colors.surfaceMuted,
      fg: colors.primary,
      border: 'transparent',
    },
    danger: {
      bg: colors.dangerSoft,
      pressed: colors.dangerSoft,
      fg: colors.danger,
      border: 'transparent',
    },
  }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: pressed ? palette.pressed : palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
        },
        variant === 'primary' && !inactive && shadow(1),
        block && styles.block,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={palette.fg} />
        )}
        <Text
          variant={size === 'sm' ? 'caption' : 'bodyStrong'}
          style={{ color: palette.fg, fontWeight: '700' }}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 50, paddingHorizontal: space.xl },
  sm: { minHeight: TOUCH_TARGET, paddingHorizontal: space.lg },
  block: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
