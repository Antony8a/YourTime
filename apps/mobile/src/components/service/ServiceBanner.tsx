import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { Task } from '@yourtime/shared-types';
import { t } from '@yourtime/shared-utils';
import { useActiveServices } from '@/api/hooks';
import { Icon, PressableScale, Text } from '@/components/ui';
import { taskStatusLabel } from '@/lib/messages';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/**
 * Sits above the tab bar while the person has a service under way, as client or
 * as worker, and takes them back to its live screen.
 */
export function ServiceBanner() {
  const { data } = useActiveServices();
  const tasks = [data?.as_worker, data?.as_client].filter((t): t is Task => !!t);
  if (tasks.length === 0) return null;
  return (
    <View style={styles.stack}>
      {tasks.map((item) => (
        <Banner key={item.id} task={item} />
      ))}
    </View>
  );
}

function Banner({ task }: { task: Task }) {
  const { colors, shadow } = useTheme();
  const router = useRouter();
  const counterpart = task.is_worker ? task.poster : task.assigned_applicant;
  const role = task.is_worker ? t('Estás haciendo') : t('Estás contratando');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('{role}: {title}. {status}. Abrir servicio', {
        role,
        title: task.title,
        status: t(taskStatusLabel[task.status]),
      })}
      onPress={() => router.push({ pathname: '/service/[id]', params: { id: task.id } })}
      scaleTo={0.985}
      style={[styles.banner, shadow(2), { backgroundColor: colors.primary }]}
    >
      <LiveDot />
      <View style={styles.text}>
        <Text variant="caption" style={[styles.light, { color: colors.onPrimary, opacity: 0.8 }]}>
          {role} · {t(taskStatusLabel[task.status])}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1} style={{ color: colors.onPrimary }}>
          {counterpart?.full_name ?? task.title}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color="onPrimary" />
    </PressableScale>
  );
}

/** A small beating dot: the one place where "this is live" is worth a loop. */
function LiveDot() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
      -1,
      false
    );
  }, [pulse, reduceMotion]);
  const ring = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.3 : 0.5 * (1 - pulse.value),
    transform: [{ scale: reduceMotion ? 1.5 : 1 + pulse.value * 1.6 }],
  }));
  return (
    <View style={styles.dotBox}>
      <Animated.View style={[styles.ring, { backgroundColor: colors.onPrimary }, ring]} />
      <View style={[styles.dot, { backgroundColor: colors.onPrimary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
  },
  text: { flex: 1 },
  light: { fontWeight: '600' },
  dotBox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
