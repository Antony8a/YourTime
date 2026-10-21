import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Render a non-scrolling container (use when the child is a FlatList). */
  scroll?: boolean;
  /** Reserve space for the tab bar / a bottom bar. */
  bottomInset?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Hide the top safe-area padding when a native header is shown. */
  noTopInset?: boolean;
  padded?: boolean;
}

export function Screen({
  children,
  scroll = true,
  bottomInset = 0,
  refreshing,
  onRefresh,
  noTopInset = false,
  padded = true,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const top = noTopInset ? 0 : insets.top;

  return (
    <KeyboardAvoidingView
      role="main"
      style={[styles.flex, { backgroundColor: colors.bg, paddingTop: top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            padded && styles.padded,
            { paddingBottom: space.xxxl + bottomInset },
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: space.xl, paddingTop: space.lg },
});
