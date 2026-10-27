import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '@yourtime/shared-utils';
import { useCreateTask } from '@/api/hooks';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { TaskForm } from '@/components/task/TaskForm';
import { Screen, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

export default function PublishScreen() {
  const router = useRouter();
  const { toast } = useFeedback();
  const create = useCreateTask();
  // Changing the key remounts the form so it starts empty after a successful publish.
  const [formKey, setFormKey] = useState(0);

  return (
    <Screen bottomInset={space.xl}>
      <View style={{ gap: space.xs, marginBottom: space.xxl }}>
        <Text variant="display">{t('Publicar tarea')}</Text>
        <Text tone="muted">
          {t('Cuenta qué necesitas. Recibirás postulaciones y tú eliges a quién.')}
        </Text>
      </View>

      <TaskForm
        key={formKey}
        submitLabel={t('Publicar tarea')}
        loading={create.isPending}
        error={create.error}
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: (task) => {
              toast(t('Tarea publicada. Revisa las postulaciones en la pestaña Actividad.'));
              setFormKey((k) => k + 1);
              router.push({ pathname: '/task/[id]', params: { id: task.id } });
            },
          })
        }
      />
    </Screen>
  );
}
