import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/tokens';

export type IconName = keyof typeof Ionicons.glyphMap;

/** The backend sends icon names as strings; fall back instead of rendering "?". */
export function safeIcon(
  name: string | undefined,
  fallback: IconName = 'ellipse-outline'
): IconName {
  return name && name in Ionicons.glyphMap ? (name as IconName) : fallback;
}

interface IconProps {
  name: IconName;
  size?: number;
  /** A palette key, or a literal colour such as a category colour. */
  color?: keyof Palette | (string & {});
}

export function Icon({ name, size = 20, color = 'text' }: IconProps) {
  const { colors } = useTheme();
  const resolved = color in colors ? colors[color as keyof Palette] : color;
  return <Ionicons name={name} size={size} color={resolved} />;
}
