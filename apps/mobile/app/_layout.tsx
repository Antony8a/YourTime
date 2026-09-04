import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '../src/providers';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <Stack
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: 'gray.50' },
            }}
          >
            <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
            <Stack.Screen name="(app)" options={{ presentation: 'push' }} />
            <Stack.Screen name="(modal)" options={{ presentation: 'modal' }} />
            <Stack.Screen name="+not-found" options={{ presentation: 'modal' }} />
          </Stack>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}