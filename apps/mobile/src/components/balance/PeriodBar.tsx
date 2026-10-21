import { ScrollView, StyleSheet, View } from 'react-native';
import {
  PRESETS,
  canShift,
  formatRange,
  matchPreset,
  presetRange,
  shiftRange,
  type DateRange,
} from '@yourtime/shared-utils';
import { Chip, Icon, PressableScale, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, TOUCH_TARGET } from '@/theme/tokens';

interface PeriodBarProps {
  range: DateRange;
  today: Date;
  onChange: (range: DateRange) => void;
  /** Open the calendar. */
  onCustom: () => void;
}

/**
 * Three ways to set the period, from quickest to most exact: a preset chip, the
 * arrows that step the current period back or forward, and the calendar.
 */
export function PeriodBar({ range, today, onChange, onCustom }: PeriodBarProps) {
  const { colors } = useTheme();
  const preset = matchPreset(range, today);
  const label = formatRange(range);

  const step = (dir: -1 | 1) => {
    haptics.select();
    onChange(shiftRange(range, dir, today));
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Bleeds to the screen edges so chips scroll under the margin, not stop at it.
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
        accessibilityRole="toolbar"
        accessibilityLabel="Periodo"
      >
        {PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            selected={preset === p.id}
            onPress={() => {
              haptics.select();
              onChange(presetRange(p.id, today));
            }}
          />
        ))}
        <Chip
          label="Elegir fechas"
          icon="calendar-outline"
          selected={preset === 'custom'}
          onPress={onCustom}
        />
      </ScrollView>

      <View
        style={[styles.current, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <StepButton
          icon="chevron-back"
          label="Periodo anterior"
          disabled={!canShift(range, -1, today)}
          onPress={() => step(-1)}
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Periodo: ${label}. Cambiar fechas`}
          onPress={onCustom}
          scaleTo={0.98}
          style={styles.label}
        >
          <Icon name="calendar-outline" size={16} color="primary" />
          <Text variant="bodyStrong" style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </PressableScale>
        <StepButton
          icon="chevron-forward"
          label="Periodo siguiente"
          disabled={!canShift(range, 1, today)}
          onPress={() => step(1)}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.9}
      style={[styles.step, { opacity: disabled ? 0.3 : 1 }]}
    >
      <Icon name={icon} size={20} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  step: {
    width: TOUCH_TARGET + 4,
    height: TOUCH_TARGET + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    minHeight: TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  labelText: { fontVariant: ['tabular-nums'] },
});
