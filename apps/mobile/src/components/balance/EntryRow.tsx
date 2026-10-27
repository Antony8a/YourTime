import { StyleSheet, View } from 'react-native';
import type { BalanceEntry } from '@yourtime/shared-types';
import { formatDay, formatMoney, roundForDisplay, t, toKey } from '@yourtime/shared-utils';
import { Card, Icon, safeIcon, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

interface EntryRowProps {
  entry: BalanceEntry;
  /** Money in (a service you did) or out (a service you requested). */
  direction: 'in' | 'out';
  /** The currency of the account, which `converted_minor` is in. */
  accountCurrency: string;
  onPress: () => void;
}

/** One finished service in the balance list. */
export function EntryRow({ entry, direction, accountCurrency, onPress }: EntryRowProps) {
  const sign = direction === 'in' ? '+' : '−';
  const amount = `${sign}${formatMoney(entry.amount_minor, entry.currency)}`;
  const withWho =
    direction === 'in'
      ? t('para {name}', { name: entry.counterpart.full_name })
      : t('con {name}', { name: entry.counterpart.full_name });
  const date = formatDay(toKey(new Date(entry.completed_at)));
  const converted =
    entry.converted_minor != null
      ? formatMoney(roundForDisplay(entry.converted_minor, accountCurrency), accountCurrency)
      : null;

  return (
    <Card
      onPress={onPress}
      padded={false}
      accessibilityLabel={`${entry.title}, ${withWho}, ${date}, ${amount} ${entry.currency}${converted ? t(', aproximadamente {converted} en tu moneda', { converted }) : ''}`}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${entry.category.color}1F` }]}>
          <Icon name={safeIcon(entry.category.icon)} size={20} color={entry.category.color} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {entry.title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {withWho} · {date}
          </Text>
        </View>
        <Text
          variant="bodyStrong"
          tone={direction === 'in' ? 'success' : 'default'}
          style={styles.tabular}
        >
          {amount}
        </Text>
      </View>
      {converted ? (
        <Text variant="caption" tone="subtle" style={[styles.tabular, styles.converted]}>
          ≈ {converted}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 64,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  converted: {
    textAlign: 'right',
    paddingHorizontal: space.md,
    marginTop: -space.xs,
    paddingBottom: space.md,
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
