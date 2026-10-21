/**
 * Design tokens. Every colour, size and radius in the app comes from here so
 * the look stays consistent and dark mode is a single switch.
 */

export interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  shadow: string;
  /** Filled star in ratings. Same hue in both themes. */
  star: string;
  /** The area around the app column on wide screens (web, tablets). */
  canvas: string;
}

export const lightPalette: Palette = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F1F8',
  border: '#E4E6F0',
  text: '#0F172A',
  textMuted: '#4B5668',
  textSubtle: '#5F6A7E',
  primary: '#4F46E5',
  primaryPressed: '#4338CA',
  primarySoft: '#EDEEFF',
  onPrimary: '#FFFFFF',
  success: '#047857',
  successSoft: '#E4F6EE',
  warning: '#9A4A06',
  warningSoft: '#FEF1DC',
  danger: '#B91C1C',
  dangerSoft: '#FDECEC',
  info: '#0369A1',
  infoSoft: '#E4F2FA',
  overlay: 'rgba(15, 23, 42, 0.48)',
  shadow: '#1B2142',
  star: '#F5A524',
  canvas: '#E8EAF4',
};

export const darkPalette: Palette = {
  bg: '#0B0D14',
  surface: '#151824',
  surfaceMuted: '#1D2132',
  border: '#2A2F45',
  text: '#F3F4F8',
  textMuted: '#A5ADC2',
  textSubtle: '#8B93AD',
  primary: '#818CF8',
  primaryPressed: '#6366F1',
  primarySoft: '#23274A',
  onPrimary: '#0B0D14',
  success: '#34D399',
  successSoft: '#12332A',
  warning: '#FBBF24',
  warningSoft: '#3A2C10',
  danger: '#F87171',
  dangerSoft: '#3A1A1D',
  info: '#38BDF8',
  infoSoft: '#0F2A3A',
  overlay: 'rgba(0, 0, 0, 0.62)',
  shadow: '#000000',
  star: '#F5B83D',
  canvas: '#05060A',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label';

export const typography: Record<
  TextVariant,
  {
    fontSize: number;
    lineHeight: number;
    fontWeight: '400' | '500' | '600' | '700' | '800';
    letterSpacing?: number;
  }
> = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6 },
};

/** Minimum touch target recommended by iOS and Android guidelines. */
export const TOUCH_TARGET = 44;
