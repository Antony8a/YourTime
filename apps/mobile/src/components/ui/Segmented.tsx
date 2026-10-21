import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, TOUCH_TARGET } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const { colors, shadow } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            scaleTo={0.97}
            style={[styles.item, selected && [{ backgroundColor: colors.surface }, shadow(1)]]}
          >
            <Text
              variant="caption"
              tone={selected ? 'default' : 'muted'}
              style={{ fontWeight: selected ? '700' : '600' }}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    borderRadius: radius.sm + 2,
  },
});
