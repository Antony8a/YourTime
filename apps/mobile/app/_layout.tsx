import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { bootstrapSession } from '@/api/session';
import { AppFrame } from '@/components/AppFrame';
import { BrandMark } from '@/components/BrandMark';
import { PortalHost } from '@/components/ui/Portal';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import { useAuth } from '@/store/auth';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx never helps; transient failures get two more tries.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <FeedbackProvider>
            <AuthGate />
            <PortalHost />
          </FeedbackProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Restores the session, then keeps people on the right side of the login wall. */
function AuthGate() {
  const { colors, isDark } = useTheme();
  const status = useAuth((s) => s.status);
  const segments = useSegments();
  const router = useRouter();
  const navigationKey = useRootNavigationState()?.key;

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    // Never show one person's cached data to the next person on this device.
    if (status === 'signedOut') queryClient.clear();
  }, [status]);

  useEffect(() => {
    if (!navigationKey || status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'signedOut' && !inAuthGroup) router.replace('/login');
    else if (status === 'signedIn' && inAuthGroup) router.replace('/');
  }, [status, segments, navigationKey, router]);

  if (status === 'loading') {
    return (
      <AppFrame>
        <View style={[styles.splash, { backgroundColor: colors.bg }]}>
          <BrandMark size={72} />
          <ActivityIndicator color={colors.primary} />
        </View>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
});
