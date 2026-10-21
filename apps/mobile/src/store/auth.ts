import { create } from 'zustand';
import type { Session, User } from '@yourtime/shared-types';
import { storage } from '@/lib/storage';

const ACCESS_KEY = 'yt.access';
const REFRESH_KEY = 'yt.refresh';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  /** Load saved tokens from secure storage. Returns false when there are none. */
  restoreTokens: () => Promise<boolean>;
  /** Store a freshly issued session (login, register, refresh). */
  applySession: (session: Session) => Promise<void>;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  refreshToken: null,

  async restoreTokens() {
    const [accessToken, refreshToken] = await Promise.all([
      storage.get(ACCESS_KEY),
      storage.get(REFRESH_KEY),
    ]);
    if (!refreshToken) {
      set({ status: 'signedOut' });
      return false;
    }
    set({ accessToken, refreshToken });
    return true;
  },

  async applySession(session) {
    set({
      user: session.user,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      status: 'signedIn',
    });
    await Promise.all([
      storage.set(ACCESS_KEY, session.access_token),
      storage.set(REFRESH_KEY, session.refresh_token),
    ]);
  },

  setUser: (user) => set({ user }),

  async signOut() {
    set({ user: null, accessToken: null, refreshToken: null, status: 'signedOut' });
    await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
  },
}));
