import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Task } from '@yourtime/shared-types';
import { formatBudget, timeAgo } from '@yourtime/shared-utils';
import { ConvertedBudget } from '@/components/money/Converted';
import { RatingBadge } from '@/components/reviews/Stars';
import { Badge, Card, Icon, safeIcon, Text } from '@/components/ui';
import {
  applicationStatusLabel,
  applicationStatusTone,
  taskStatusLabel,
  taskStatusTone,
} from '@/lib/messages';
import { radius, space } from '@/theme/tokens';
import { DistanceBadge } from './DistanceBadge';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  /** Show the poster's pending-offer count (used on "my tasks"). */
  showOffers?: boolean;
}

function TaskCardImpl({ task, onPress, showOffers = false }: TaskCardProps) {
  const mine = task.my_application;
  return (
    <Card onPress={onPress} accessibilityLabel={`${task.title}. ${formatBudget(task.budget)}`}>
      <View style={styles.header}>
        <View style={[styles.category, { backgroundColor: `${task.category.color}1F` }]}>
          <Icon name={safeIcon(task.category.icon)} size={22} color={task.category.color} />
        </View>
        <View style={styles.headerText}>
          <Text variant="heading" level={2} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={styles.byline}>
            <Text variant="caption" tone="subtle" numberOfLines={1} style={styles.bylineText}>
              {task.is_owner ? 'Publicada por ti' : task.poster.full_name}
            </Text>
            {task.is_owner ? null : <RatingBadge rating={task.poster.rating} />}
            <Text variant="caption" tone="subtle">
              · {timeAgo(task.created_at)}
            </Text>
          </View>
        </View>
      </View>

      <Text variant="bodyStrong" tone="primary" style={styles.price}>
        {formatBudget(task.budget)}
      </Text>
      <ConvertedBudget budget={task.budget} />

      <View style={styles.badges}>
        <DistanceBadge task={task} />
        {task.status !== 'open' ? (
          <Badge label={taskStatusLabel[task.status]} tone={taskStatusTone[task.status]} />
        ) : null}
        {mine ? (
          <Badge
            label={`Tu postulación: ${applicationStatusLabel[mine.status]}`}
            tone={applicationStatusTone[mine.status]}
            icon="paper-plane-outline"
          />
        ) : null}
        {showOffers && task.applications_count > 0 && task.status === 'open' ? (
          <Badge
            label={`${task.applications_count} ${task.applications_count === 1 ? 'postulación' : 'postulaciones'}`}
            tone="primary"
            icon="people-outline"
          />
        ) : null}
        {!showOffers && task.applications_count > 0 && !mine ? (
          <Badge
            label={`${task.applications_count} ${task.applications_count === 1 ? 'postulado' : 'postulados'}`}
            icon="people-outline"
          />
        ) : null}
      </View>
    </Card>
  );
}

export const TaskCard = memo(TaskCardImpl);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  bylineText: { flexShrink: 1 },
  category: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: { marginTop: space.md, fontSize: 17, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
});
