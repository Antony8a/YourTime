import { StyleSheet, View } from 'react-native';
import type { Review } from '@yourtime/shared-types';
import { timeAgo } from '@yourtime/shared-utils';
import { Avatar, Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { StarRow, starLabel } from './Stars';

interface ReviewCardProps {
  review: Review;
  /** Small label above the card content, e.g. "Tu reseña". */
  heading?: string;
  /** Caption above the reply, e.g. "Respuesta de Ana" or "Tu respuesta". */
  replyLabel: string;
  /** Show who wrote it (public review lists). */
  showReviewer?: boolean;
  /** Shown when the viewer can answer and no reply exists yet. */
  onReply?: () => void;
}

export function ReviewCard({
  review,
  heading,
  replyLabel,
  showReviewer = false,
  onReply,
}: ReviewCardProps) {
  const { colors } = useTheme();
  const reviewer = review.reviewer;

  return (
    <Card>
      {heading ? (
        <Text variant="label" tone="subtle" style={styles.heading}>
          {heading}
        </Text>
      ) : null}

      <View style={styles.top}>
        {showReviewer && reviewer ? (
          <Avatar name={reviewer.full_name} uri={reviewer.avatar_url} size={36} />
        ) : null}
        <View style={styles.flex}>
          {showReviewer && reviewer ? <Text variant="bodyStrong">{reviewer.full_name}</Text> : null}
          <View
            style={styles.stars}
            accessible
            accessibilityLabel={`${review.rating} de 5 estrellas, ${starLabel(review.rating)}`}
          >
            <StarRow value={review.rating} size={15} />
            <Text variant="caption" tone="subtle">
              {timeAgo(review.created_at)}
            </Text>
          </View>
        </View>
      </View>

      {review.task_title ? (
        <Text variant="caption" tone="subtle" style={styles.task} numberOfLines={1}>
          Por: {review.task_title}
        </Text>
      ) : null}

      {review.comment ? (
        <Text style={styles.comment} selectable>
          {review.comment}
        </Text>
      ) : (
        <Text tone="subtle" style={styles.comment}>
          Sin comentario.
        </Text>
      )}

      {review.reply ? (
        <View
          style={[
            styles.reply,
            { borderLeftColor: colors.primary, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Text variant="caption" tone="muted" style={styles.replyHead}>
            {replyLabel}
            {review.replied_at ? ` · ${timeAgo(review.replied_at)}` : ''}
          </Text>
          <Text selectable>{review.reply}</Text>
        </View>
      ) : onReply ? (
        <View style={styles.replyAction}>
          <Button
            label="Responder"
            icon="chatbubble-outline"
            variant="secondary"
            size="sm"
            onPress={onReply}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { marginBottom: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stars: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  task: { marginTop: space.sm },
  comment: { marginTop: space.md },
  reply: {
    marginTop: space.md,
    padding: space.md,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    gap: 2,
  },
  replyHead: { fontWeight: '600' },
  replyAction: { flexDirection: 'row', marginTop: space.md },
});
