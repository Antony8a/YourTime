import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ApiProblem, Page, Session } from '@yourtime/shared-types';
import { messageFor, messageForRule } from '@/lib/errors';
import { storage } from '@/lib/storage';
import { useAuth } from '@/store/auth';

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL for a physical device (use your
 * computer's LAN IP, e.g. http://192.168.1.20:8080). The Android emulator
 * reaches the host machine at 10.0.2.2.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // When served by Expo dev tools, the dev machine's address is also the API's.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS !== 'web' && host && host !== 'localhost') return `http://${host}:8080`;
  if (Platform.OS === 'android' && !host) return 'http://10.0.2.2:8080';
  return 'http://localhost:8080';
}

const API_URL_KEY = 'yourtime.api_url';
const defaultApiUrl = resolveBaseUrl();
let apiUrl = defaultApiUrl;

/** The API the app is talking to right now. */
export const getApiUrl = () => apiUrl;
/** What the app uses when the person has not chosen a server. */
export const getDefaultApiUrl = () => defaultApiUrl;

/** Restores a server the person chose earlier. Must finish before the first request. */
export async function loadSavedApiUrl(): Promise<void> {
  const saved = await storage.get(API_URL_KEY);
  if (saved) apiUrl = saved;
}

/** Points the app at another server and remembers it; null goes back to the default. */
export async function setApiUrl(url: string | null): Promise<void> {
  apiUrl = url ?? defaultApiUrl;
  if (url) await storage.set(API_URL_KEY, url);
  else await storage.remove(API_URL_KEY);
}

/** Whether a server answers like ours, within a few seconds. Never throws. */
export async function checkApiUrl(url: string, timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/health`, { signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    return response.ok && (body as { status?: string } | null)?.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Long enough for a sleeping free-tier server to wake up (about a minute). */
const REQUEST_TIMEOUT_MS = 75_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly problem?: ApiProblem
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Stable machine-readable code from the API, when it sent one. */
  get code(): string | undefined {
    return this.problem?.code;
  }

  /** Field-level messages (in Spanish) keyed by field name, for forms. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.problem?.errors ?? []) out[e.field] = messageForRule(e.code);
    return out;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the Authorization header and the refresh-on-401 behaviour. */
  anonymous?: boolean;
}

interface Envelope<T> {
  data: T;
  meta?: Page<T>['meta'];
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${apiUrl}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function send<T>(
  path: string,
  opts: RequestOptions,
  token: string | null
): Promise<Envelope<T>> {
  let response: Response;
  // A free host puts an idle server to sleep and takes about a minute to wake it,
  // so wait that long, then say so instead of hanging forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? 'El servidor tarda en responder; puede estar despertando. Inténtalo de nuevo en un momento.'
        : 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return { data: undefined as T };
  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const problem = json as ApiProblem | null;
    throw new ApiError(
      response.status,
      messageFor(response.status, problem?.code),
      problem ?? undefined
    );
  }
  return json as Envelope<T>;
}

// One refresh at a time: concurrent 401s must share the same refresh call,
// otherwise they would race and invalidate each other's tokens.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, applySession, signOut } = useAuth.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await send<Session>(
      '/auth/refresh',
      { method: 'POST', body: { refresh_token: refreshToken }, anonymous: true },
      null
    );
    await applySession(data);
    return data.access_token;
  } catch (error) {
    // Only an explicit rejection ends the session; a network blip must not log people out.
    if (error instanceof ApiError && error.status === 401) await signOut();
    return null;
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<Envelope<T>> {
  const token = opts.anonymous ? null : useAuth.getState().accessToken;
  // Signed out (e.g. a screen still mounted while logging out): fail locally
  // instead of sending a request that is certain to be rejected.
  if (!opts.anonymous && !token) throw new ApiError(401, messageFor(401));
  try {
    return await send<T>(path, opts, token);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      opts.anonymous ||
      !useAuth.getState().refreshToken
    ) {
      throw error;
    }
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    const fresh = await refreshing;
    if (!fresh) throw error;
    return send<T>(path, opts, fresh);
  }
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) =>
    request<T>(path, { query }).then((r) => r.data),
  page: <T>(path: string, query?: RequestOptions['query']) =>
    request<T[]>(path, { query }).then((r): Page<T> => ({
      data: r.data,
      meta: r.meta ?? { has_more: false, limit: 0, offset: 0 },
    })),
  post: <T>(path: string, body?: unknown, anonymous = false) =>
    request<T>(path, { method: 'POST', body, anonymous }).then((r) => r.data),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body }).then((r) => r.data),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body }).then((r) => r.data),
};
