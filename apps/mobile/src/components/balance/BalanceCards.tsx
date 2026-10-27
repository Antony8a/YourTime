import { StyleSheet, View } from 'react-native';
import type { BalanceSide, BalanceTotal } from '@yourtime/shared-types';
import { formatMoney, roundForDisplay, SUPPORTED_CURRENCIES, t, tn } from '@yourtime/shared-utils';
import { Card, Icon, Text, type IconName } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const services = (n: number) => tn(n, '{count} servicio', '{count} servicios');

/** The money format already carries the symbol or code ("US$ 85", "45.000 COP"), so none is repeated. */
function Amount({
  minor,
  currency,
  small = false,
}: {
  minor: number;
  currency: string;
  small?: boolean;
}) {
  return (
    <Text variant={small ? 'heading' : 'title'} level={0} style={styles.amount}>
      {formatMoney(minor, currency)}
    </Text>
  );
}

function SummaryCard({
  title,
  icon,
  tone,
  side,
  emptyCurrency,
}: {
  title: string;
  icon: IconName;
  tone: 'success' | 'primary';
  side: BalanceSide;
  /** Shown as zero when there is nothing yet. */
  emptyCurrency: string;
}) {
  const { colors } = useTheme();
  const accent = tone === 'success' ? colors.success : colors.primary;
  const soft = tone === 'success' ? colors.successSoft : colors.primarySoft;
  const count = side.totals.reduce((n, t) => n + t.count, 0);
  const several = side.totals.length > 1;
  // The combined figure only adds something when more than one currency is involved.
  const showConverted =
    side.converted != null && side.totals.some((t) => t.currency !== side.converted!.currency);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, { backgroundColor: soft }]}>
          <Icon name={icon} size={16} color={accent} />
        </View>
        <Text variant="caption" tone="muted" style={styles.cardTitle}>
          {title}
        </Text>
      </View>

      {side.totals.length === 0 ? (
        <Amount minor={0} currency={emptyCurrency} />
      ) : (
        side.totals.map((t) => (
          <Amount key={t.currency} minor={t.total_minor} currency={t.currency} small={several} />
        ))
      )}

      {showConverted ? (
        <Text variant="caption" tone="muted" style={styles.amount}>
          {side.converted!.partial ? t('Al menos ≈') : '≈'}{' '}
          {formatMoney(
            roundForDisplay(side.converted!.total_minor, side.converted!.currency),
            side.converted!.currency
          )}
        </Text>
      ) : null}

      <Text variant="caption" tone="subtle">
        {services(count)}
      </Text>
    </Card>
  );
}

/** Earned and spent side by side. */
export function SummaryCards({
  earned,
  spent,
  currency,
}: {
  earned: BalanceSide;
  spent: BalanceSide;
  /** The account currency, used to show a zero. */
  currency: string;
}) {
  return (
    <View style={styles.pair}>
      <SummaryCard
        title={t('Ganado')}
        icon="trending-up"
        tone="success"
        side={earned}
        emptyCurrency={currency}
      />
      <SummaryCard
        title={t('Gastado')}
        icon="trending-down"
        tone="primary"
        side={spent}
        emptyCurrency={currency}
      />
    </View>
  );
}

/**
 * Earned minus spent. First in the person's own currency, adding every currency
 * up at the rate of the day each service was finished; then per currency, with
 * the original amounts, so nothing is hidden behind the conversion.
 */
export function NetCard({
  earned,
  spent,
  currency,
}: {
  earned: BalanceSide;
  spent: BalanceSide;
  /** The account currency. */
  currency: string;
}) {
  const { colors } = useTheme();
  const currencies = [
    ...new Set([...earned.totals, ...spent.totals].map((t) => t.currency)),
  ].sort();
  if (currencies.length === 0) return null;

  const of = (list: BalanceTotal[], c: string) =>
    list.find((t) => t.currency === c)?.total_minor ?? 0;
  const mixed = currencies.some((c) => c !== currency);

  // A side with nothing at all converts to zero; a side that could not be converted does not.
  const total = (s: BalanceSide) =>
    s.totals.length === 0 ? 0 : s.converted ? s.converted.total_minor : null;
  const e = total(earned);
  const sp = total(spent);
  const netAll = e != null && sp != null ? e - sp : null;
  const approximate = !!(earned.converted?.approximate || spent.converted?.approximate);
  const partial = !!(earned.converted?.partial || spent.converted?.partial);

  // `approx` rounds away the cents of a converted figure; the originals stay exact.
  const money = (net: number, c: string, approx = false) =>
    `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatMoney(approx ? roundForDisplay(Math.abs(net), c) : Math.abs(net), c)}`;
  const showTotal = mixed && netAll != null;

  return (
    <Card>
      <Text variant="label" tone="subtle" style={styles.netLabel}>
        {t('BALANCE NETO')}
      </Text>

      {showTotal ? (
        <View
          style={styles.netTotal}
          accessible
          accessibilityLabel={t(
            netAll >= 0
              ? 'En tu moneda, {currency}: a favor aproximadamente {amount}'
              : 'En tu moneda, {currency}: en contra aproximadamente {amount}',
            {
              currency,
              amount: formatMoney(roundForDisplay(Math.abs(netAll), currency), currency),
            }
          )}
        >
          <Text variant="caption" tone="muted">
            {t('En tu moneda ({currency}), aproximado', { currency })}
          </Text>
          <Text
            variant="display"
            level={0}
            tone={netAll > 0 ? 'success' : 'default'}
            style={styles.amount}
          >
            {partial ? '≥ ' : '≈ '}
            {money(netAll, currency, true)}
          </Text>
          <Text variant="caption" tone="subtle">
            {approximate
              ? t(
                  'Usa el cambio del día de cada servicio; en servicios antiguos, el más cercano disponible.'
                )
              : t('Usa el tipo de cambio del día en que se finalizó cada servicio.')}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.netRows,
          showTotal && [styles.netRowsSplit, { borderTopColor: colors.border }],
        ]}
      >
        {currencies.map((c) => {
          const net = of(earned.totals, c) - of(spent.totals, c);
          return (
            <View
              key={c}
              style={styles.netRow}
              accessible
              accessibilityLabel={t(
                net >= 0 ? '{currency}: a favor {amount}' : '{currency}: en contra {amount}',
                {
                  currency: c,
                  amount: formatMoney(Math.abs(net), c),
                }
              )}
            >
              <Text tone="muted" numberOfLines={1} style={styles.netName}>
                {t(SUPPORTED_CURRENCIES.find((x) => x.code === c)?.name ?? c)}
              </Text>
              <Text
                variant={mixed ? 'heading' : 'title'}
                level={0}
                tone={net > 0 ? 'success' : 'default'}
                style={styles.amount}
              >
                {money(net, c)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space.md },
  card: { flex: 1, gap: space.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontWeight: '600' },
  amount: { fontVariant: ['tabular-nums'] },
  netLabel: { marginBottom: space.sm },
  netTotal: { gap: 2, marginBottom: space.md },
  netRows: { gap: space.sm },
  netRowsSplit: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  netRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
  },
  netName: { flex: 1 },
});
