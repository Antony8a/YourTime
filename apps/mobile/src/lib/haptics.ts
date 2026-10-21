import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics fire at the causal moment, once per user action, and always next to a
 * visual change (never as the only feedback). They do nothing on web.
 */
const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => undefined);
};

export const haptics = {
  /** Picking one option among several (a star, a chip). */
  select: () => run(() => Haptics.selectionAsync()),
  /** A meaningful action completed (applied, chosen, reviewed). */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A destructive or refused action. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
