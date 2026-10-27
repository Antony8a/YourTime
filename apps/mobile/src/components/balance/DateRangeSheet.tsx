import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import {
  type CalendarCell,
  type DateKey,
  type DateRange,
  daysInRange,
  formatDay,
  formatMonth,
  monthGrid,
  MONTHS,
  parseKey,
  t,
  tn,
  toKey,
  WEEKDAYS,
} from '@yourtime/shared-utils';
import { Button, Icon, PressableScale, Sheet, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { DURATION } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, TOUCH_TARGET } from '@/theme/tokens';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const CELL = TOUCH_TARGET;
const DISC = 40;

interface DateRangeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The range in force; "all time" starts the picker empty. */
  value: DateRange;
  today: Date;
  onApply: (range: DateRange) => void;
}

/**
 * Pick a period on a calendar: tap the first day, then the last. Days can be
 * picked in either order, a single tap then Apply gives one day, and the future
 * is off limits (nothing can have been earned there).
 */
export function DateRangeSheet({ visible, onClose, value, today, onApply }: DateRangeSheetProps) {
  const { colors } = useTheme();
  const todayKey = toKey(today);

  const [from, setFrom] = useState<DateKey | null>(value.from);
  const [to, setTo] = useState<DateKey | null>(value.to);
  const [view, setView] = useState(() => monthOf(value.to ?? todayKey));

  // Each time it opens it starts from the range in force.
  useEffect(() => {
    if (!visible) return;
    setFrom(value.from);
    setTo(value.to);
    setView(monthOf(value.to ?? todayKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const picking = from === null || to !== null ? 'start' : 'end';
  const viewingCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  const pick = (key: DateKey) => {
    haptics.select();
    if (picking === 'start') {
      setFrom(key);
      setTo(null);
    } else if (from !== null && key < from) {
      setTo(from);
      setFrom(key);
    } else {
      setTo(key);
    }
  };

  const step = (dir: -1 | 1) => {
    haptics.select();
    setView((v) => {
      const d = new Date(v.year, v.month + dir, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const apply = () => {
    if (from === null) return;
    onApply({ from, to: to ?? from });
    onClose();
  };

  const summary =
    from === null
      ? t('Elige el primer día')
      : to === null
        ? t('Ahora elige el último día, o aplica solo este')
        : tn(daysInRange(from, to), '{count} día', '{count} días');

  return (
    <Sheet visible={visible} onClose={onClose} title={t('Elegir periodo')} scroll={false}>
      <View style={styles.fields}>
        <Field label={t('Desde')} value={from} active={picking === 'start'} />
        <Icon name="arrow-forward" size={16} color="textSubtle" />
        <Field label={t('Hasta')} value={to} active={picking === 'end'} />
      </View>
      <Text variant="caption" tone="muted" accessibilityLiveRegion="polite" style={styles.summary}>
        {summary}
      </Text>

      <View style={styles.monthBar}>
        <NavButton icon="chevron-back" label={t('Mes anterior')} onPress={() => step(-1)} />
        <Text
          variant="heading"
          level={0}
          style={styles.monthTitle}
          accessibilityLiveRegion="polite"
        >
          {formatMonth(view.year, view.month)}
        </Text>
        <NavButton
          icon="chevron-forward"
          label={t('Mes siguiente')}
          onPress={() => step(1)}
          disabled={viewingCurrentMonth}
        />
      </View>

      <View
        style={styles.weekdays}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {WEEKDAYS.map((d, i) => (
          <View key={i} style={styles.weekday}>
            <Text variant="label" tone="subtle" style={styles.weekdayText}>
              {t(d)}
            </Text>
          </View>
        ))}
      </View>

      <Month
        year={view.year}
        month={view.month}
        from={from}
        to={to}
        todayKey={todayKey}
        onPick={pick}
        borderColor={colors.border}
      />

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label={t('Cancelar')} variant="ghost" onPress={onClose} block />
        </View>
        <View style={styles.flex}>
          <Button label={t('Aplicar')} onPress={apply} disabled={from === null} block />
        </View>
      </View>
    </Sheet>
  );
}

const monthOf = (key: DateKey) => {
  const d = parseKey(key);
  return { year: d.getFullYear(), month: d.getMonth() };
};

function Field({
  label,
  value,
  active,
}: {
  label: string;
  value: DateKey | null;
  active: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value ? formatDay(value) : t('sin elegir')}`}
      style={[
        styles.field,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      <Text variant="label" tone={active ? 'primary' : 'subtle'}>
        {label.toUpperCase()}
      </Text>
      <Text variant="bodyStrong" tone={value ? 'default' : 'subtle'} style={styles.tabular}>
        {value ? formatDay(value) : '—'}
      </Text>
    </View>
  );
}

function NavButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.9}
      style={[styles.nav, { backgroundColor: colors.surfaceMuted, opacity: disabled ? 0.35 : 1 }]}
    >
      <Icon name={icon} size={20} />
    </PressableScale>
  );
}

/** The grid for one month. Changing month slides it a few pixels in from the side. */
function Month({
  year,
  month,
  from,
  to,
  todayKey,
  onPick,
  borderColor,
}: {
  year: number;
  month: number;
  from: DateKey | null;
  to: DateKey | null;
  todayKey: DateKey;
  onPick: (key: DateKey) => void;
  borderColor: string;
}) {
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const index = year * 12 + month;
  const previous = useRef(index);
  const enter = useRef(new Animated.Value(1)).current;
  const dir = useRef(0);

  useEffect(() => {
    if (previous.current === index) return;
    dir.current = index > previous.current ? 1 : -1;
    previous.current = index;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: DURATION.enter,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [index, enter]);

  return (
    <Animated.View
      style={[
        styles.grid,
        {
          opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            {
              translateX: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [dir.current * 14, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Fixed height so the sheet does not jump between 4-, 5- and 6-week months. */}
      <View style={[styles.weeks, { borderColor }]}>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((cell) => (
              <Day
                key={cell.key}
                cell={cell}
                from={from}
                to={to}
                todayKey={todayKey}
                onPick={onPick}
              />
            ))}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const Day = memo(function Day({
  cell,
  from,
  to,
  todayKey,
  onPick,
}: {
  cell: CalendarCell;
  from: DateKey | null;
  to: DateKey | null;
  todayKey: DateKey;
  onPick: (key: DateKey) => void;
}) {
  const { colors } = useTheme();
  if (!cell.inMonth) return <View style={styles.cell} />;

  const { key } = cell;
  const future = key > todayKey;
  const isStart = key === from;
  const isEnd = key === (to ?? from);
  const selected = isStart || isEnd;
  const hasSpan = from !== null && to !== null && from !== to;
  const inside = hasSpan && key > from! && key < to!;
  const isToday = key === todayKey;

  const label =
    t('{day} de {month} de {year}', {
      day: cell.day,
      month: t(MONTHS[parseKey(key).getMonth()]!),
      year: key.slice(0, 4),
    }) +
    (isStart && hasSpan
      ? t(', inicio del periodo')
      : isEnd && hasSpan
        ? t(', fin del periodo')
        : '') +
    (isToday ? ', hoy' : '');

  return (
    <View style={styles.cell}>
      {/* The soft band behind a range; the ends only reach to the middle of their cell. */}
      {inside ? <View style={[styles.band, { backgroundColor: colors.primarySoft }]} /> : null}
      {hasSpan && isStart ? (
        <View style={[styles.band, styles.bandRight, { backgroundColor: colors.primarySoft }]} />
      ) : null}
      {hasSpan && isEnd ? (
        <View style={[styles.band, styles.bandLeft, { backgroundColor: colors.primarySoft }]} />
      ) : null}

      {/* The whole cell is the touch target (44 pt); the disc is only what you see. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled: future }}
        disabled={future}
        onPress={() => onPick(key)}
        style={styles.touch}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.disc,
              selected && { backgroundColor: colors.primary },
              !selected && isToday && { borderColor: colors.primary, borderWidth: 1.5 },
              !selected && pressed && !future && { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <Text
              variant="bodyStrong"
              tone={selected ? 'onPrimary' : future ? 'subtle' : isToday ? 'primary' : 'default'}
              style={[styles.tabular, future && styles.future]}
            >
              {cell.day}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fields: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  summary: { marginTop: -space.xs },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  nav: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: { flexDirection: 'row', marginBottom: -space.sm },
  weekday: { flex: 1, alignItems: 'center' },
  weekdayText: { letterSpacing: 0 },
  grid: {},
  weeks: { minHeight: CELL * 6 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  // Bands overlap their neighbours by a pixel: on dense screens cell edges land on
  // fractional pixels and a seam shows between them otherwise.
  band: {
    position: 'absolute',
    top: (CELL - DISC) / 2,
    bottom: (CELL - DISC) / 2,
    left: -1,
    right: -1,
  },
  bandRight: { left: '50%', right: -1 },
  bandLeft: { right: '50%', left: -1 },
  touch: { width: '100%', height: CELL, alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  future: { opacity: 0.45 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
