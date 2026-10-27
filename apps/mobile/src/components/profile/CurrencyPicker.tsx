import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SUPPORTED_CURRENCIES, t } from '@yourtime/shared-utils';
import { Icon, Input, Sheet, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

interface CurrencyPickerProps {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

/** Searchable list of supported currencies, shown in a sheet. */
export function CurrencyPicker({ visible, selected, onSelect, onClose }: CurrencyPickerProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPORTED_CURRENCIES;
    return SUPPORTED_CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || t(c.name).toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Moneda de tu cuenta')}
      subtitle={t('Se usa para mostrar y publicar precios.')}
    >
      <Input
        icon="search"
        placeholder={t('Buscar moneda')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />
      <View style={styles.list}>
        {results.map((c) => {
          const active = c.code === selected;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onSelect(c.code);
                setQuery('');
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: active
                    ? colors.primarySoft
                    : pressed
                      ? colors.surfaceMuted
                      : 'transparent',
                },
              ]}
            >
              <Text variant="bodyStrong" style={styles.code}>
                {c.code}
              </Text>
              <Text tone="muted" style={styles.name}>
                {t(c.name)}
              </Text>
              {active ? <Icon name="checkmark-circle" size={20} color="primary" /> : null}
            </Pressable>
          );
        })}
        {results.length === 0 ? (
          <Text tone="muted" style={styles.empty}>
            {t('No encontramos esa moneda.')}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
  },
  code: { width: 48 },
  name: { flex: 1 },
  empty: { textAlign: 'center', paddingVertical: space.lg },
});
