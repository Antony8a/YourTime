import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { WalletTransaction, WalletTransactionKind } from '@yourtime/shared-types';
import {
  formatMoney,
  formatPercent,
  msg,
  parseAmount,
  t,
  timeAgo,
  toMinor,
} from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import {
  flatten,
  useRedeemCode,
  useTestTopup,
  useWallet,
  useWalletTransactions,
} from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Input,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** What each kind of movement is called in the history. */
const KIND_LABEL: Record<WalletTransactionKind, string> = {
  topup_test: msg('Recarga de prueba'),
  topup_manual: msg('Recarga'),
  topup_bonus: msg('Bono por recarga'),
  promo_credit: msg('Crédito promocional'),
  signup_credit: msg('Crédito de bienvenida'),
  fee: msg('Comisión'),
  fee_refund: msg('Devolución de comisión'),
};

/** The prepaid credit spent on commissions when someone is chosen for a task. */
export default function WalletScreen() {
  const wallet = useWallet();
  const history = useWalletTransactions();
  const topup = useTestTopup();
  const redeem = useRedeemCode();
  const { toast } = useFeedback();
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();

  const w = wallet.data;
  const rows = flatten(history.data?.pages);
  const refreshing = wallet.isRefetching || history.isRefetching;
  const refresh = () => {
    void wallet.refetch();
    void history.refetch();
  };

  const recharge = (minor: number) => {
    if (!w) return;
    setAmountError(undefined);
    topup.mutate(minor, {
      onSuccess: (r) => {
        setAmountText('');
        toast(
          r.bonus_minor > 0
            ? t('Recarga lista. Más un bono de {bonus}.', {
                bonus: formatMoney(r.bonus_minor, r.currency),
              })
            : t('Recarga lista.')
        );
      },
      onError: (e) => setAmountError(e instanceof ApiError ? e.message : t('No pudimos recargar.')),
    });
  };

  const submitAmount = () => {
    if (!w) return;
    const amount = parseAmount(amountText);
    if (amount == null) {
      setAmountError(t('Escribe un monto válido.'));
      return;
    }
    recharge(toMinor(amount, w.currency));
  };

  const submitCode = () => {
    setCodeError(undefined);
    redeem.mutate(code.trim(), {
      onSuccess: (r) => {
        setCode('');
        toast(
          r.kind === 'fee_discount'
            ? t('Código aplicado: {percent} de descuento en la comisión.', {
                percent: formatPercent(r.discount_bps),
              })
            : t('Código aplicado: {amount} a tu billetera.', {
                amount: formatMoney(r.credited_minor, r.currency),
              })
        );
      },
      onError: (e) =>
        setCodeError(e instanceof ApiError ? e.message : t('No pudimos aplicar el código.')),
    });
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title={t('Billetera')} />
      <Screen noTopInset onRefresh={refresh} refreshing={refreshing}>
        {wallet.isPending ? (
          <View style={styles.stack}>
            <Skeleton height={150} />
            <Skeleton height={120} />
          </View>
        ) : wallet.isError || !w ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t('No pudimos cargar tu billetera')}
            actionLabel={t('Reintentar')}
            onAction={() => void wallet.refetch()}
          />
        ) : (
          <View style={styles.stack}>
            <Card>
              <Text variant="caption" tone="muted">
                {t('Saldo disponible')}
              </Text>
              <Text variant="display" level={0} style={styles.balance}>
                {formatMoney(w.balance_minor, w.currency)}
              </Text>
              <Text variant="caption" tone="subtle">
                {w.established
                  ? t('Tu billetera es en {currency} y esa moneda ya no se puede cambiar.', {
                      currency: w.currency,
                    })
                  : t(
                      'Tu billetera será en {currency}, la moneda de tu cuenta. Después de la primera recarga ya no se puede cambiar.',
                      { currency: w.currency }
                    )}
              </Text>
            </Card>

            <Card>
              <Text variant="heading">{t('Cómo funciona')}</Text>
              <Text tone="muted" style={styles.gap}>
                {w.fee_bps > 0
                  ? t(
                      'Para postularte necesitas saldo. Si te eligen, se descuenta {percent} del precio acordado. Si no te eligen, no pagas nada.',
                      { percent: formatPercent(w.fee_bps) }
                    )
                  : t('Ahora mismo no se cobra comisión.')}
              </Text>
              {w.discount_bps > 0 ? (
                <Text variant="caption" tone="success" style={styles.gap}>
                  {t('Tienes {percent} de descuento en la comisión.', {
                    percent: formatPercent(w.discount_bps),
                  })}
                </Text>
              ) : null}
              <Text variant="caption" tone="subtle" style={styles.gap}>
                {t('El saldo no se retira: se gasta en nuevas tareas.')}
              </Text>
            </Card>

            {w.test_topups_enabled ? (
              <View style={styles.section}>
                <Text variant="heading">{t('Recargar')}</Text>
                <Text variant="caption" tone="subtle">
                  {t('Recargas de prueba: no se cobra dinero real.')}
                </Text>
                {w.suggested_topups_minor.length > 0 ? (
                  <View style={styles.wrap}>
                    {w.suggested_topups_minor.map((minor) => (
                      <Chip
                        key={minor}
                        label={formatMoney(minor, w.currency)}
                        onPress={() => recharge(minor)}
                      />
                    ))}
                  </View>
                ) : null}
                <Input
                  label={t('Otro monto ({currency})', { currency: w.currency })}
                  prefix={w.currency}
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  hint={t('Máximo por recarga: {max}', {
                    max: formatMoney(w.test_topup_max_minor, w.currency),
                  })}
                  error={amountError}
                />
                <Button
                  label={t('Recargar')}
                  icon="add-circle-outline"
                  onPress={submitAmount}
                  loading={topup.isPending}
                  disabled={amountText.trim() === ''}
                  block
                />
              </View>
            ) : (
              <Card>
                <Text tone="muted">
                  {t(
                    'Las recargas de prueba están desactivadas. Pídele una recarga a quien administra la app.'
                  )}
                </Text>
              </Card>
            )}

            <View style={styles.section}>
              <Text variant="heading">{t('¿Tienes un código?')}</Text>
              <Input
                label={t('Código promocional')}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                error={codeError}
              />
              <Button
                label={t('Canjear código')}
                variant="secondary"
                onPress={submitCode}
                loading={redeem.isPending}
                disabled={code.trim() === ''}
                block
              />
            </View>

            <View style={styles.section}>
              <Text variant="heading">{t('Movimientos')}</Text>
              {history.isPending ? (
                <Skeleton height={64} />
              ) : rows.length === 0 ? (
                <Text tone="muted">{t('Aún no hay movimientos.')}</Text>
              ) : (
                rows.map((row) => <TransactionRow key={row.id} row={row} />)
              )}
              {history.hasNextPage ? (
                <Button
                  label={t('Ver más movimientos')}
                  variant="secondary"
                  onPress={() => void history.fetchNextPage()}
                  loading={history.isFetchingNextPage}
                  block
                />
              ) : null}
            </View>
          </View>
        )}
      </Screen>
    </View>
  );
}

function TransactionRow({ row }: { row: WalletTransaction }) {
  const { colors } = useTheme();
  const router = useRouter();
  const credit = row.amount_minor > 0;
  const detail = row.task_title ?? row.note;
  return (
    <Card
      padded={false}
      onPress={
        row.task_id
          ? () => router.push({ pathname: '/task/[id]', params: { id: row.task_id! } })
          : undefined
      }
      accessibilityLabel={t('{kind}: {amount}', {
        kind: t(KIND_LABEL[row.kind]),
        amount: formatMoney(row.amount_minor, row.currency),
      })}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: credit ? colors.successSoft : colors.dangerSoft },
          ]}
        >
          <Icon
            name={credit ? 'arrow-down' : 'arrow-up'}
            size={18}
            color={credit ? 'success' : 'danger'}
          />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t(KIND_LABEL[row.kind])}</Text>
          {detail ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          <Text variant="caption" tone="subtle">
            {timeAgo(row.created_at)}
          </Text>
        </View>
        <View style={styles.amount}>
          <Text variant="bodyStrong" tone={credit ? 'success' : 'danger'}>
            {credit ? '+' : ''}
            {formatMoney(row.amount_minor, row.currency)}
          </Text>
          <Text variant="caption" tone="subtle">
            {formatMoney(row.balance_after_minor, row.currency)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.lg },
  section: { gap: space.md },
  gap: { marginTop: space.sm },
  balance: { marginVertical: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { alignItems: 'flex-end' },
});
