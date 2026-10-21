import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ALL_TIME, presetRange, sameRange, type DateRange } from '@yourtime/shared-utils';
import { useBalance } from '@/api/hooks';
import { DateRangeSheet } from '@/components/balance/DateRangeSheet';
import { NetCard, SummaryCards } from '@/components/balance/BalanceCards';
import { EntryRow } from '@/components/balance/EntryRow';
import { PeriodBar } from '@/components/balance/PeriodBar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button, EmptyState, Screen, Segmented, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { space } from '@/theme/tokens';

type Side = 'earned' | 'spent';

/** What the person earned doing services and spent on services they requested, over a period. */
export default function BalanceScreen() {
  const router = useRouter();
  const currency = useAuth((s) => s.user?.currency ?? 'USD');
  const today = useMemo(() => new Date(), []);

  const [range, setRange] = useState<DateRange>(() => presetRange('thisMonth', today));
  const [picking, setPicking] = useState(false);
  const [side, setSide] = useState<Side>('earned');

  const balance = useBalance(range);
  const data = balance.data;
  const refreshing = balance.isFetching && !balance.isPending;

  const countOf = (s: Side) => data?.[s].totals.reduce((n, t) => n + t.count, 0) ?? 0;
  const entries = data?.[side].entries ?? [];

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Mi balance" />
      <Screen noTopInset onRefresh={() => void balance.refetch()} refreshing={balance.isRefetching}>
        <View style={styles.stack}>
          <PeriodBar
            range={range}
            today={today}
            onChange={setRange}
            onCustom={() => setPicking(true)}
          />

          {balance.isPending ? (
            <View style={styles.stack}>
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Skeleton height={112} />
                </View>
                <View style={styles.flex}>
                  <Skeleton height={112} />
                </View>
              </View>
              <Skeleton height={84} />
              <Skeleton height={64} />
            </View>
          ) : balance.isError || !data ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="No pudimos cargar tu balance"
              actionLabel="Reintentar"
              onAction={() => void balance.refetch()}
            />
          ) : (
            // Dimmed, not replaced, while the next period loads.
            <View style={[styles.stack, refreshing && styles.refreshing]}>
              <SummaryCards earned={data.earned} spent={data.spent} currency={currency} />
              <NetCard earned={data.earned} spent={data.spent} currency={data.currency} />

              <Segmented<Side>
                value={side}
                onChange={setSide}
                options={[
                  { value: 'earned', label: `Ganado (${countOf('earned')})` },
                  { value: 'spent', label: `Gastado (${countOf('spent')})` },
                ]}
              />

              {entries.length === 0 ? (
                <EmptyState
                  icon={side === 'earned' ? 'trending-up' : 'trending-down'}
                  title={
                    side === 'earned'
                      ? 'No hay servicios realizados en este periodo'
                      : 'No hay servicios solicitados en este periodo'
                  }
                  message={
                    sameRange(range, ALL_TIME)
                      ? side === 'earned'
                        ? 'Cuando termines un servicio, el pago aparecerá aquí.'
                        : 'Cuando un servicio que pediste se finalice, lo verás aquí.'
                      : 'Prueba con otro periodo para ver más movimientos.'
                  }
                  actionLabel={sameRange(range, ALL_TIME) ? undefined : 'Ver todo el historial'}
                  onAction={() => setRange(ALL_TIME)}
                />
              ) : (
                <View style={styles.list}>
                  {entries.map((e) => (
                    <EntryRow
                      key={e.task_id}
                      entry={e}
                      direction={side === 'earned' ? 'in' : 'out'}
                      accountCurrency={data.currency}
                      onPress={() =>
                        router.push({ pathname: '/task/[id]', params: { id: e.task_id } })
                      }
                    />
                  ))}
                  {data[side].has_more ? (
                    <Text variant="caption" tone="subtle" style={styles.more}>
                      Mostramos los {entries.length} más recientes. Los totales incluyen todos los
                      servicios del periodo.
                    </Text>
                  ) : null}
                </View>
              )}

              <Text variant="caption" tone="subtle">
                Cuenta los servicios finalizados dentro del periodo, al precio acordado y en la
                moneda en que se acordó. La conversión a tu moneda es solo una referencia: usa el
                tipo de cambio del día en que se finalizó cada servicio. Tipos de cambio de Exchange
                Rate API (exchangerate-api.com).
              </Text>
            </View>
          )}
        </View>
      </Screen>

      <DateRangeSheet
        visible={picking}
        onClose={() => setPicking(false)}
        value={range}
        today={today}
        onApply={setRange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.lg },
  pair: { flexDirection: 'row', gap: space.md },
  list: { gap: space.sm },
  more: { textAlign: 'center', marginTop: space.xs },
  refreshing: { opacity: 0.55 },
});
