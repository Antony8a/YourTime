import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: ViewStyle;
}

export function Card({ children, onPress, accessibilityLabel, padded = true, style }: CardProps) {
  const { colors, shadow } = useTheme();
  const base: ViewStyle[] = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
    shadow(1),
    padded ? styles.padded : {},
    style ?? {},
  ];

  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      // Large surfaces shrink less: a 3% scale on a full-width card is a lot of pixels.
      scaleTo={0.985}
      style={({ pressed }) => [...base, pressed && { opacity: 0.94 }]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: space.lg },
});
