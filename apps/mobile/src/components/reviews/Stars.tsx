import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Rating } from '@yourtime/shared-types';
import { intlLocale, msg, t, tn } from '@yourtime/shared-utils';
import { Icon, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';

const STAR_LABELS = [
  msg('Mala'),
  msg('Regular'),
  msg('Buena'),
  msg('Muy buena'),
  msg('Excelente'),
] as const;

export function starLabel(value: number): string {
  const label = STAR_LABELS[value - 1];
  return label ? t(label) : '';
}

/** "4,8" or "4.8" by language; one decimal always so "5" reads as "5,0". */
export function formatAverage(value: number): string {
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** A read-only row of five stars, with half stars. Decorative: callers label it. */
export function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i - 0.25 ? 'star' : value >= i - 0.75 ? 'star-half' : 'star-outline';
        return (
          <Icon
            key={i}
            name={name}
            size={size}
            color={name === 'star-outline' ? 'textSubtle' : 'star'}
          />
        );
      })}
    </View>
  );
}

function StarButton({
  index,
  filled,
  size,
  onSelect,
}: {
  index: number;
  filled: boolean;
  size: number;
  onSelect: (value: number) => void;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: filled }}
      accessibilityLabel={tn(index, '{count} estrella', '{count} estrellas')}
      hitSlop={4}
      onPress={() => {
        haptics.select();
        // A small pop that settles: tells the finger exactly which star it hit.
        if (!reduceMotion) {
          scale.value = withSequence(
            withTiming(1.22, { duration: 90, easing: EASE_OUT }),
            withSpring(1, { damping: 11, stiffness: 240 })
          );
        }
        onSelect(index);
      }}
      style={styles.starTouch}
    >
      <Animated.View style={animated}>
        <Icon
          name={filled ? 'star' : 'star-outline'}
          size={size}
          color={filled ? 'star' : 'textSubtle'}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Pick 1 to 5 stars. */
export function StarInput({
  value,
  onChange,
  size = 38,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('Calificación')} style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarButton key={i} index={i} filled={i <= value} size={size} onSelect={onChange} />
      ))}
    </View>
  );
}

/**
 * The reviews summary shown next to a name: "★ 4,8 (12)". The number in
 * parentheses is how many people rated. With none, it says so plainly.
 */
export function RatingBadge({ rating }: { rating: Rating }) {
  if (rating.count === 0) {
    return (
      <View style={styles.badge} accessible accessibilityLabel={t('Sin calificaciones todavía')}>
        <Icon name="star-outline" size={13} color="textSubtle" />
        <Text variant="caption" tone="muted">
          {t('Sin calificaciones')}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={tn(
        rating.count,
        'Calificación {average} de 5, según {count} persona',
        'Calificación {average} de 5, según {count} personas',
        { average: formatAverage(rating.average) }
      )}
    >
      <Icon name="star" size={13} color="star" />
      <Text variant="caption" style={styles.average}>
        {formatAverage(rating.average)}
      </Text>
      <Text variant="caption" tone="muted">
        ({rating.count})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  starTouch: { padding: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  average: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
