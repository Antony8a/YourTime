import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Task } from '@yourtime/shared-types';
import {
  formatBudget,
  formatDistance,
  fromMinor,
  parseAmount,
  toMinor,
} from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { useApply } from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ConvertedAmount, ConvertedBudget } from '@/components/money/Converted';
import { Button, Input, Sheet, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

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

  const submit = () => {
    const amount = parseAmount(priceText);
    if (amount == null) {
      setError('Escribe el precio que propones.');
      return;
    }
    setError(undefined);
    apply.mutate(
      { price_minor: toMinor(amount, currency), message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast('Postulación enviada. Quien publicó la tarea decidirá.');
          onClose();
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'No pudimos enviar tu postulación.'),
      }
    );
  };

  const farAway = task.within_preferred_radius === false && task.distance_km != null;

  return (
    <Sheet visible={visible} onClose={onClose} title="Postularme" subtitle={task.title}>
      {farAway ? (
        <Text variant="caption" tone="warning">
          Esta tarea queda a {formatDistance(task.distance_km!)}, fuera de tu radio preferido.
          Puedes postularte igual; confirma que te sirve.
        </Text>
      ) : null}
      <Input
        label={`Tu precio (${currency})`}
        prefix={currency}
        value={priceText}
        onChangeText={setPriceText}
        keyboardType="decimal-pad"
        placeholder="0"
        hint={`Presupuesto de la tarea: ${formatBudget(task.budget)}`}
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
        label="Mensaje (opcional)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        placeholder="Cuéntale por qué eres buena opción: experiencia, disponibilidad, herramientas…"
      />
      <View style={{ gap: space.sm }}>
        <Button
          label="Enviar postulación"
          icon="paper-plane-outline"
          onPress={submit}
          loading={apply.isPending}
          block
        />
      </View>
    </Sheet>
  );
}
