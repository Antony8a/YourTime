import { LinearGradient } from 'expo-linear-gradient';
import { t } from '@yourtime/shared-utils';
import { Icon } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/** The YourTime logo mark: the app icon's clock on its indigo gradient. */
export function BrandMark({ size = 56 }: { size?: number }) {
  const { isDark, shadow } = useTheme();
  return (
    <LinearGradient
      accessibilityLabel={t('YourTime')}
      colors={isDark ? ['#8B93FA', '#6366F1'] : ['#6366F1', '#4338CA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadow(2),
      ]}
    >
      <Icon name="time" size={size * 0.58} color="#FFFFFF" />
    </LinearGradient>
  );
}
