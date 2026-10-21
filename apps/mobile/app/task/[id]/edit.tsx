import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTask, useUpdateTask } from '@/api/hooks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { TaskForm } from '@/components/task/TaskForm';
import { EmptyState, Screen, Skeleton } from '@/components/ui';
import { space } from '@/theme/tokens';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useFeedback();
  const query = useTask(id);
  const update = useUpdateTask(id);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Editar tarea" />
      <Screen noTopInset bottomInset={space.xl}>
        {query.isLoading ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={48} />
            <Skeleton height={120} />
          </View>
        ) : !query.data ? (
          <EmptyState
            icon="alert-circle-outline"
            title="No pudimos cargar la tarea"
            actionLabel="Reintentar"
            onAction={() => void query.refetch()}
          />
        ) : query.data.status !== 'open' || !query.data.is_owner ? (
          <EmptyState
            icon="lock-closed-outline"
            title="Esta tarea ya no se puede editar"
            message="Solo puedes editar tus tareas mientras estén abiertas."
          />
        ) : (
          <TaskForm
            task={query.data}
            submitLabel="Guardar cambios"
            loading={update.isPending}
            error={update.error}
            onSubmit={(input) =>
              update.mutate(input, {
                onSuccess: () => {
                  toast('Cambios guardados.');
                  router.back();
                },
              })
            }
          />
        )}
      </Screen>
    </View>
  );
}
