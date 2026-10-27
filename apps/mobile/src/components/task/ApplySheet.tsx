import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Task } from '@yourtime/shared-types';
import {
  formatBudget,
  formatDistance,
  formatMoney,
  formatPercent,
  fromMinor,
  parseAmount,
  t,
  toMinor,
} from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { useApply, useFeeQuote } from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ConvertedAmount, ConvertedBudget } from '@/components/money/Converted';
import { Button, Card, Input, Sheet, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

/** The value, but only once it has stopped changing for `ms`: one request per pause, not per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

interface ApplySheetProps {
  task: Task;
  visible: boolean;
  onClose: () => void;
}

export function ApplySheet({ task, visible, onClose }: ApplySheetProps) {
  const { toast } = useFeedback();
  const apply = useApply(task.id);
  const currency = task.budget.currency;

  const [priceText, setPriceText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();

  // Start from the poster's lower bound; it is only a suggestion.
  useEffect(() => {
    if (visible) {
      setPriceText(
        task.budget.min_minor != null ? String(fromMinor(task.budget.min_minor, currency)) : ''
      );
      setMessage('');
      setError(undefined);
    }
  }, [visible, task.budget.min_minor, currency]);

  const typed = parseAmount(priceText);
  const router = useRouter();
  // What being chosen at this price would cost in commission, and whether the wallet covers it.
  const priceMinor = typed != null ? toMinor(typed, currency) : null;
  const quote = useFeeQuote(task.id, useDebounced(priceMinor, 400), visible).data;
  const cannotAfford = quote != null && !quote.enough;

  const submit = () => {
    const amount = parseAmount(priceText);
    if (amount == null) {
      setError(t('Escribe el precio que propones.'));
      return;
    }
    setError(undefined);
    apply.mutate(
      { price_minor: toMinor(amount, currency), message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast(t('Postulación enviada. Quien publicó la tarea decidirá.'));
          onClose();
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : t('No pudimos enviar tu postulación.')),
      }
    );
  };

  const farAway = task.within_preferred_radius === false && task.distance_km != null;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('Postularme')} subtitle={task.title}>
      {farAway ? (
        <Text variant="caption" tone="warning">
          {t(
            'Esta tarea queda a {distance}, fuera de tu radio preferido. Puedes postularte igual; confirma que te sirve.',
            { distance: formatDistance(task.distance_km!) }
          )}
        </Text>
      ) : null}
      <Input
        label={t('Tu precio ({currency})', { currency })}
        prefix={currency}
        value={priceText}
        onChangeText={setPriceText}
        keyboardType="decimal-pad"
        placeholder="0"
        hint={t('Presupuesto de la tarea: {value}', { value: formatBudget(task.budget) })}
        error={error}
      />
      {typed != null ? (
        <View style={{ marginTop: -space.sm }}>
          <ConvertedAmount minor={toMinor(typed, currency)} currency={currency} />
        </View>
      ) : (
        <ConvertedBudget budget={task.budget} />
      )}
      <Input
        label={t('Mensaje (opcional)')}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        placeholder={t(
          'Cuéntale por qué eres buena opción: experiencia, disponibilidad, herramientas…'
        )}
      />
      {quote && quote.fee_minor > 0 ? (
        <Card>
          <Text variant="bodyStrong">
            {t('Comisión si te eligen: {fee}', {
              fee: formatMoney(quote.fee_minor, quote.currency),
            })}
          </Text>
          <Text variant="caption" tone="muted">
            {quote.discount_bps > 0
              ? t(
                  '{percent} del precio, con {discount} de descuento. No pagas nada si no te eligen.',
                  {
                    percent: formatPercent(quote.fee_bps),
                    discount: formatPercent(quote.discount_bps),
                  }
                )
              : t('{percent} del precio. No pagas nada si no te eligen.', {
                  percent: formatPercent(quote.fee_bps),
                })}
          </Text>
          <Text variant="caption" tone={cannotAfford ? 'warning' : 'muted'}>
            {t('Tu billetera: {balance}', {
              balance: formatMoney(quote.balance_minor, quote.currency),
            })}
          </Text>
          {cannotAfford ? (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <Text variant="caption" tone="warning">
                {t('Tu saldo no alcanza para postularte. Recarga tu billetera.')}
              </Text>
              <Button
                label={t('Recargar billetera')}
                variant="secondary"
                icon="card-outline"
                onPress={() => {
                  onClose();
                  router.push('/wallet');
                }}
                block
              />
            </View>
          ) : null}
        </Card>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Button
          label={t('Enviar postulación')}
          icon="paper-plane-outline"
          onPress={submit}
          loading={apply.isPending}
          disabled={cannotAfford}
          block
        />
      </View>
    </Sheet>
  );
}
