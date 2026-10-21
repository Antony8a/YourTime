import type { Task } from '@yourtime/shared-types';
import { formatDistance } from '@yourtime/shared-utils';
import { Badge } from '@/components/ui';

/**
 * Shows how far a task is. The colour is a hint relative to the person's
 * preferred radius: green inside it, amber outside it. It never blocks anything.
 */
export function DistanceBadge({
  task,
}: {
  task: Pick<Task, 'is_remote' | 'distance_km' | 'within_preferred_radius'>;
}) {
  if (task.is_remote) return <Badge label="Remoto" icon="globe-outline" tone="info" />;
  if (task.distance_km == null) return null;

  const label = `A ${formatDistance(task.distance_km)}`;
  if (task.within_preferred_radius === true)
    return <Badge label={label} icon="navigate-outline" tone="success" />;
  if (task.within_preferred_radius === false)
    return <Badge label={label} icon="navigate-outline" tone="warning" />;
  return <Badge label={label} icon="navigate-outline" tone="neutral" />;
}
