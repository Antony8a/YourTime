import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme, type ViewStyle } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './tokens';

export interface Theme {
  colors: Palette;
  isDark: boolean;
  /** Soft elevation that reads well in both light and dark. */
  shadow: (level?: 1 | 2) => ViewStyle;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo<Theme>(() => {
    const isDark = scheme === 'dark';
    const colors = isDark ? darkPalette : lightPalette;
    return {
      colors,
      isDark,
      shadow: (level = 1) =>
        Platform.select<ViewStyle>({
          android: { elevation: level === 1 ? 2 : 6 },
          default: {
            shadowColor: colors.shadow,
            shadowOpacity: isDark ? 0.4 : level === 1 ? 0.07 : 0.14,
            shadowRadius: level === 1 ? 10 : 22,
            shadowOffset: { width: 0, height: level === 1 ? 3 : 10 },
          },
        }) ?? {},
    };
  }, [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
