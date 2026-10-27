import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, type Palette, type TextVariant } from '@/theme/tokens';

/** Variants that act as headings, and the level they get by default. */
const HEADING_LEVEL: Partial<Record<TextVariant, 1 | 2 | 3>> = { display: 1, title: 2, heading: 3 };

export type TextTone =
  'default' | 'muted' | 'subtle' | 'primary' | 'success' | 'warning' | 'danger' | 'onPrimary';

const toneColor: Record<TextTone, keyof Palette> = {
  default: 'text',
  muted: 'textMuted',
  subtle: 'textSubtle',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  onPrimary: 'onPrimary',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Heading level for screen readers. Defaults from the variant; pass 1 for the screen's main title, 0 for big text that is not a heading. */
  level?: 0 | 1 | 2 | 3;
}

export function Text({ variant = 'body', tone = 'default', level, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  // level 0 opts out: large text that is not a heading (prices, big numbers).
  const headingLevel = level === 0 ? undefined : (level ?? HEADING_LEVEL[variant]);
  // aria-level is honoured by react-native-web and ignored natively.
  const semantics = headingLevel
    ? ({ accessibilityRole: 'header', 'aria-level': headingLevel } as object)
    : null;
  return (
    <RNText
      {...semantics}
      {...rest}
      style={[
        typography[variant],
        { color: colors[toneColor[tone]] },
        variant === 'label' && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
