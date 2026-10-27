import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Review } from '@yourtime/shared-types';
import { t } from '@yourtime/shared-utils';
import { ApiError } from '@/api/client';
import { useCreateReview, useReplyReview } from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Button, Input, Sheet, Text } from '@/components/ui';
import { space } from '@/theme/tokens';
import { StarInput, starLabel } from './Stars';

interface ReviewSheetProps {
  taskId: string;
  /** The person being rated. */
  counterpartName: string;
  visible: boolean;
  onClose: () => void;
}

/** Rate the other person after a task is completed: 1 to 5 stars and an optional comment. */
export function ReviewSheet({ taskId, counterpartName, visible, onClose }: ReviewSheetProps) {
  const { toast } = useFeedback();
  const create = useCreateReview(taskId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (visible) {
      setRating(0);
      setComment('');
      setError(undefined);
    }
  }, [visible]);

  const submit = () => {
    if (rating === 0) {
      setError(t('Elige de 1 a 5 estrellas.'));
      return;
    }
    setError(undefined);
    create.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast(t('Calificaste a {counterpartName}. ¡Gracias!', { counterpartName }));
          onClose();
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : t('No pudimos enviar tu reseña.')),
      }
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('¿Cómo te fue con {counterpartName}?', { counterpartName })}
      subtitle={t('Tu calificación ayuda a otras personas a decidir. Podrá responderte.')}
    >
      <View style={styles.center}>
        <StarInput
          value={rating}
          onChange={(v) => {
            setRating(v);
            setError(undefined);
          }}
        />
        <Text
          variant="bodyStrong"
          tone={rating ? 'default' : 'subtle'}
          accessibilityLiveRegion="polite"
        >
          {rating ? starLabel(rating) : t('Toca una estrella')}
        </Text>
      </View>
      <Input
        label={t('Comentario (opcional)')}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={1000}
        placeholder={t('Cuenta cómo fue: puntualidad, trato, calidad del trabajo…')}
        error={error}
      />
      <Button
        label={t('Enviar reseña')}
        icon="star"
        onPress={submit}
        loading={create.isPending}
        block
      />
      <Button label={t('Ahora no')} variant="ghost" onPress={onClose} block />
    </Sheet>
  );
}

interface ReplySheetProps {
  review: Review | null;
  /** Task to refresh after replying, when answering from a task screen. */
  taskId?: string;
  visible: boolean;
  onClose: () => void;
}

/** Answer a review once. */
export function ReplySheet({ review, taskId, visible, onClose }: ReplySheetProps) {
  const { toast } = useFeedback();
  const reply = useReplyReview(taskId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (visible) {
      setText('');
      setError(undefined);
    }
  }, [visible]);

  const submit = () => {
    if (!review) return;
    if (!text.trim()) {
      setError(t('Escribe tu respuesta.'));
      return;
    }
    setError(undefined);
    reply.mutate(
      { reviewId: review.id, text: text.trim() },
      {
        onSuccess: () => {
          toast(t('Respuesta publicada.'));
          onClose();
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : t('No pudimos publicar tu respuesta.')),
      }
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('Responder reseña')}
      subtitle={review?.comment ? `“${review.comment}”` : t('Solo puedes responder una vez.')}
    >
      <Input
        label={t('Tu respuesta')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        placeholder={t('Agradece o aclara lo que haga falta. Será pública y no se puede editar.')}
        error={error}
      />
      <Button label={t('Publicar respuesta')} onPress={submit} loading={reply.isPending} block />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm },
});
