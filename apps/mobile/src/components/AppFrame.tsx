import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useInertWhenHidden } from '@/lib/webA11y';
import { useTheme } from '@/theme/ThemeProvider';

/** Widest the app column gets; beyond this the screen is just empty canvas. */
export const MAX_COLUMN = 560;

/**
 * Keeps the app a phone-width column on wide screens (browser, tablet) instead
 * of stretching every card across a desktop monitor. On a phone it is invisible.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  useInertWhenHidden();
  const framed = width > MAX_COLUMN + 32;

  return (
    <View style={[styles.canvas, { backgroundColor: framed ? colors.canvas : colors.bg }]}>
      <View
        style={[
          styles.column,
          { backgroundColor: colors.bg },
          framed && { borderColor: colors.border, borderLeftWidth: 1, borderRightWidth: 1 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MAX_COLUMN, overflow: 'hidden' },
});
