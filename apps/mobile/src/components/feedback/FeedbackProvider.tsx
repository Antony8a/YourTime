import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Sheet, Text, type IconName } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type ToastTone = 'success' | 'error' | 'info';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface Feedback {
  toast: (message: string, tone?: ToastTone) => void;
  /** Cross-platform replacement for Alert.alert (which does nothing on web). */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}

const TOAST_MS = 3200;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<{
    id: number;
    message: string;
    tone: ToastTone;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    counter.current += 1;
    setToastState({ id: counter.current, message, tone });
    // Paired with the visual toast, never on its own.
    if (tone === 'success') haptics.success();
    else if (tone === 'error') haptics.warning();
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    []
  );

  // Keep the last texts while the sheet plays its exit animation.
  const [shown, setShown] = useState<ConfirmOptions | null>(null);
  useEffect(() => {
    if (confirmState) setShown(confirmState);
  }, [confirmState]);

  const settle = (ok: boolean) => {
    const pending = confirmState;
    setConfirmState(null);
    // Let the sheet finish closing before the caller changes screens.
    setTimeout(() => pending?.resolve(ok), DURATION.exit + 60);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastView state={toastState} onDone={() => setToastState(null)} />
      <Sheet
        visible={confirmState !== null}
        onClose={() => settle(false)}
        title={shown?.title ?? ''}
        subtitle={shown?.message}
        scroll={false}
      >
        <View style={styles.actions}>
          <Button
            label={shown?.confirmLabel ?? 'Confirmar'}
            variant={shown?.destructive ? 'danger' : 'primary'}
            onPress={() => settle(true)}
            block
          />
          <Button
            label={shown?.cancelLabel ?? 'Cancelar'}
            variant="ghost"
            onPress={() => settle(false)}
            block
          />
        </View>
      </Sheet>
    </FeedbackContext.Provider>
  );
}

function ToastView({
  state,
  onDone,
}: {
  state: { id: number; message: string; tone: ToastTone } | null;
  onDone: () => void;
}) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!state) return;
    cancelAnimation(progress);
    progress.value = 0;
    // In: quick ease-out. Out: quicker still. Neither uses ease-in.
    progress.value = withSequence(
      withTiming(1, { duration: DURATION.enter, easing: EASE_OUT }),
      withDelay(
        TOAST_MS,
        withTiming(0, { duration: DURATION.exit, easing: EASE_OUT }, (finished) => {
          if (finished) runOnJS(onDone)();
        })
      )
    );
    // Restart only when a new toast arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.id]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (progress.value - 1) * 16 }],
  }));

  if (!state) return null;
  const scheme: Record<ToastTone, { icon: IconName; color: string; bg: string }> = {
    success: { icon: 'checkmark-circle', color: colors.success, bg: colors.successSoft },
    error: { icon: 'alert-circle', color: colors.danger, bg: colors.dangerSoft },
    info: { icon: 'information-circle', color: colors.info, bg: colors.infoSoft },
  };
  const s = scheme[state.tone];

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        shadow(2),
        {
          top: insets.top + space.sm,
          backgroundColor: colors.surface,
          borderColor: s.color,
        },
        animated,
      ]}
    >
      <View style={[styles.toastIcon, { backgroundColor: s.bg }]}>
        <Icon name={s.icon} size={18} color={s.color} />
      </View>
      <Text variant="bodyStrong" style={styles.toastText}>
        {state.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.sm },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    left: space.xl,
    right: space.xl,
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  toastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { flex: 1 },
});
