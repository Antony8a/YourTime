import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MeResponse } from '@yourtime/shared-types';

interface AuthState {
  user: MeResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string; remember_me?: boolean }) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; phone?: string }) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

const API_URL = 'http://localhost:8080/api/v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: false,

      login: async (credentials) => {
        set({ loading: true });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
          });
          if (!response.ok) throw new Error('Credenciales inválidas');
          const data = await response.json();
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            loading: false,
          });
        } catch (err: any) {
          set({ loading: false });
          throw err;
        }
      },

      register: async (data) => {
        set({ loading: true });
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Error al registrarse');
          const resData = await response.json();
          set({
            user: resData.user,
            accessToken: resData.access_token,
            refreshToken: resData.refresh_token,
            loading: false,
          });
        } catch (err: any) {
          set({ loading: false });
          throw err;
        }
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null });
      },

      fetchUser: async () => {
        const token = get().accessToken;
        if (!token) return;
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const user = await response.json();
            set({ user });
          } else if (response.status === 401) {
            await get().refreshAccessToken();
            await get().fetchUser();
          }
        } catch {
          // Silently fail
        }
      },

      refreshAccessToken: async () => {
        const refresh = get().refreshToken;
        if (!refresh) throw new Error('No refresh token');
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          if (!response.ok) throw new Error('Token expirado');
          const data = await response.json();
          set({ accessToken: data.access_token });
        } catch {
          get().logout();
          throw new Error('Sesión expirada');
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);