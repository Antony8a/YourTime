import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Key/value storage for small secrets (auth tokens). Uses the OS keychain on
 * iOS/Android. On web there is no keychain, so it falls back to localStorage,
 * which is acceptable for development but not a hardened production setup.
 * Every call swallows storage errors: failing to persist must not crash the app.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      /* ignore */
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  },
};
