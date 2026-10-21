import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** A pulsing placeholder block used while content loads. */
export function Skeleton({
  width = '100%',
  height = 14,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceMuted,
        opacity,
      }}
    />
  );
}

/** Skeleton shaped like a TaskCard. */
export function TaskCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Skeleton width={40} height={40} />
        <View style={styles.grow}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="45%" />
        </View>
      </View>
      <Skeleton width="35%" height={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.md,
  },
  row: { flexDirection: 'row', gap: space.md },
  grow: { flex: 1, gap: space.sm },
});
