import { StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, TOUCH_TARGET } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Accent colour for the selected state, e.g. a category colour. */
  accent?: string;
}

export function Chip({ label, selected = false, onPress, icon, accent }: ChipProps) {
  const { colors } = useTheme();
  const active = accent ?? colors.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.95}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? active : colors.surface,
          borderColor: selected ? active : colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={15} color={selected ? colors.onPrimary : colors.textMuted} />
      ) : null}
      <Text
        variant="caption"
        style={{
          color: selected ? colors.onPrimary : colors.text,
          fontWeight: selected ? '700' : '600',
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
