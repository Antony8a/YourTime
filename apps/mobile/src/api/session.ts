import type { User } from '@yourtime/shared-types';
import { useAuth } from '@/store/auth';
import { api, ApiError } from './client';

/**
 * Restores the saved session when the app starts. Lives here, not in the store,
 * because it needs the API client and the client already depends on the store.
 */
export async function bootstrapSession(): Promise<void> {
  const { restoreTokens, signOut } = useAuth.getState();
  if (!(await restoreTokens())) return;

  try {
    const user = await api.get<User>('/me');
    useAuth.setState({ user, status: 'signedIn' });
  } catch (error) {
    // No connection at launch: show the login screen but keep the saved tokens
    // so the next launch can restore the session. Only a rejection from the
    // server discards them.
    if (error instanceof ApiError && error.status === 0) {
      useAuth.setState({ status: 'signedOut' });
      return;
    }
    await signOut();
  }
}
