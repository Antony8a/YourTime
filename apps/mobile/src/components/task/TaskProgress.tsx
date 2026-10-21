import { StyleSheet, View } from 'react-native';
import type { TaskStatus } from '@yourtime/shared-types';
import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const STEPS = [
  { key: 'open', label: 'Publicada' },
  { key: 'assigned', label: 'Asignada' },
  { key: 'en_route', label: 'En camino' },
  { key: 'in_progress', label: 'En servicio' },
  { key: 'completed', label: 'Finalizada' },
] as const;

interface TaskProgressProps {
  status: TaskStatus;
  /** Remote tasks have no travel, so the "en camino" step is left out. */
  remote?: boolean;
  /** Start from "Asignada": for the live service screen, where "Publicada" is noise. */
  fromAssigned?: boolean;
}

/**
 * Where the task is in its life. A cancelled task has no progress to show, so
 * it renders nothing (its badge says it).
 */
export function TaskProgress({ status, remote = false, fromAssigned = false }: TaskProgressProps) {
  const { colors } = useTheme();
  if (status === 'cancelled') return null;

  const steps = STEPS.filter(
    (s) => !(remote && s.key === 'en_route') && !(fromAssigned && s.key === 'open')
  );
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === status)
  );

  return (
    <View
      accessible
      accessibilityLabel={`Progreso: ${steps[current]?.label}, paso ${current + 1} de ${steps.length}`}
      style={styles.row}
    >
      {steps.map((step, i) => {
        const done = i <= current;
        return (
          <View key={step.key} style={[styles.step, i < steps.length - 1 && styles.grow]}>
            <View style={styles.node}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? colors.primary : colors.surface,
                    borderColor: done ? colors.primary : colors.border,
                  },
                ]}
              >
                {done ? <Icon name="checkmark" size={11} color="onPrimary" /> : null}
              </View>
              <Text
                variant="caption"
                tone={i === current ? 'default' : 'subtle'}
                style={{ fontWeight: i === current ? '700' : '500', fontSize: 11 }}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View
                style={[
                  styles.bar,
                  { backgroundColor: i < current ? colors.primary : colors.border },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.md },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
  node: { alignItems: 'center', gap: 4, width: 56 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { flex: 1, height: 2, marginTop: 9, marginHorizontal: -14, borderRadius: 1 },
});
