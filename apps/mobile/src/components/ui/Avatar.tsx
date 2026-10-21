import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

/** Deterministic hue per person so the same name always gets the same colour. */
function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const { isDark } = useTheme();
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image accessibilityLabel={name} source={{ uri }} style={dimension} />;

  const hue = hueFor(name);
  const background = isDark ? `hsl(${hue}, 35%, 26%)` : `hsl(${hue}, 70%, 91%)`;
  const foreground = isDark ? `hsl(${hue}, 75%, 82%)` : `hsl(${hue}, 60%, 24%)`;
  return (
    <View
      accessibilityLabel={name}
      style={[styles.center, dimension, { backgroundColor: background }]}
    >
      <Text
        style={{
          color: foreground,
          fontWeight: '700',
          fontSize: size * 0.38,
          lineHeight: size * 0.5,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
