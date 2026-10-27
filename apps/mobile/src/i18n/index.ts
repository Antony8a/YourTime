import { create } from 'zustand';
import { getLocale, isLocale, resolveLocale, setLocale, type Locale } from '@yourtime/shared-utils';
import { storage } from '@/lib/storage';
import { useAuth } from '@/store/auth';

/**
 * Which language the app speaks. The account's choice wins; before signing in (or
 * with no choice) it is what the person picked on this device, else the device's
 * own language. `useLanguage` exists so the root can start over when it changes.
 */

const LANGUAGE_KEY = 'yourtime.language';

/** The device's language, if we speak it; English otherwise. */
export function deviceLanguage(): Locale {
  try {
    return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

export const useLanguage = create<{ locale: Locale }>(() => ({ locale: getLocale() }));

/** Switches the whole app to a language, right now. */
export function applyLanguage(locale: Locale): void {
  if (locale === getLocale()) return;
  setLocale(locale);
  useLanguage.setState({ locale });
}

/** A language the person picked here: used at once and remembered on this device. */
export async function rememberLanguage(locale: Locale): Promise<void> {
  applyLanguage(locale);
  await storage.set(LANGUAGE_KEY, locale);
}

/** Back to the device's language, forgetting the pick on this device. */
export async function followDeviceLanguage(): Promise<void> {
  applyLanguage(deviceLanguage());
  await storage.remove(LANGUAGE_KEY);
}

/** Run once at launch, before the first screen. */
export async function initLanguage(): Promise<void> {
  const saved = await storage.get(LANGUAGE_KEY);
  applyLanguage(isLocale(saved) ? saved : deviceLanguage());
}

// The account's language, whenever it becomes known or changes, takes over.
useAuth.subscribe((state, previous) => {
  const chosen = state.user?.language;
  if (chosen && isLocale(chosen) && chosen !== previous.user?.language) applyLanguage(chosen);
});
