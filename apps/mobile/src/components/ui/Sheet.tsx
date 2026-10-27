import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@yourtime/shared-utils';
import { DURATION, ENTER_OFFSET } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { usePortals } from './Portal';
import { Text } from './Text';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Keep the content scrollable (default). Turn off for short, fixed content. */
  scroll?: boolean;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A bottom sheet that behaves the same on iOS, Android and web. It rises with a
 * short ease-out and fades the backdrop; closing is quicker than opening. With
 * reduced motion it only fades.
 */
export function Sheet({ visible, onClose, title, subtitle, children, scroll = true }: SheetProps) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // The native Modal must stay mounted while the exit animation plays.
  const [mounted, setMounted] = useState(visible);
  // React Native's own Animated, not Reanimated: inside an Android Modal the
  // Reanimated styles can miss the first open and leave the sheet invisible.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION.enter,
        easing: EASE_OUT,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: DURATION.exit,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setMounted(false), DURATION.exit + 40);
    return () => clearTimeout(timer);
  }, [visible, progress]);

  const backdrop = { opacity: progress };
  const panel = {
    opacity: progress,
    transform: [
      {
        translateY: reduceMotion
          ? 0
          : progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_OFFSET, 0] }),
      },
    ],
  };

  const body = <View style={{ gap: space.lg, paddingBottom: space.lg }}>{children}</View>;

  const id = useId();
  const overlay = mounted ? (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdrop]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Cerrar')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        role="dialog"
        aria-label={title}
        style={[
          styles.sheet,
          shadow(2),
          { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) },
          panel,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text variant="title">{title}</Text>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        </View>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  ) : null;

  // Publish on every render (before paint) so typing in a field inside the sheet
  // never lags a frame behind.
  useLayoutEffect(() => {
    if (overlay) usePortals.getState().set(id, overlay);
    else usePortals.getState().remove(id);
  });
  useLayoutEffect(() => () => usePortals.getState().remove(id), [id]);

  // Android's back button closes the sheet instead of leaving the screen.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space.lg },
  header: { gap: 4, marginBottom: space.lg },
});
