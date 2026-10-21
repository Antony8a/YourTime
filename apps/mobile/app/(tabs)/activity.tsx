import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Application, Task, TaskStatus } from '@yourtime/shared-types';
import { formatMoney, timeAgo } from '@yourtime/shared-utils';
import { flatten, useMyApplications, usePostedTasks } from '@/api/hooks';
import { ConvertedAmount } from '@/components/money/Converted';
import { TaskCard } from '@/components/task/TaskCard';
import { Badge, Card, Chip, EmptyState, Segmented, TaskCardSkeleton, Text } from '@/components/ui';
import { applicationStatusLabel, applicationStatusTone } from '@/lib/messages';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type Tab = 'posted' | 'applied';

const STATUS_FILTERS: { label: string; value: TaskStatus[] }[] = [
  { label: 'Todas', value: ['open', 'assigned', 'completed', 'cancelled'] },
  { label: 'Abiertas', value: ['open'] },
  { label: 'En curso', value: ['assigned', 'en_route', 'in_progress'] },
  { label: 'Finalizadas', value: ['completed'] },
];

export default function ActivityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('posted');

  return (
    <View role="main" style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="display">Actividad</Text>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'posted', label: 'Mis tareas' },
            { value: 'applied', label: 'Mis postulaciones' },
          ]}
        />
      </View>
      {tab === 'posted' ? <PostedList /> : <AppliedList />}
    </View>
  );
}

function PostedList() {
  const router = useRouter();
  const { colors } = useTheme();
  const [filterIndex, setFilterIndex] = useState(0);
  const query = usePostedTasks(STATUS_FILTERS[filterIndex]!.value);
  const tasks = flatten(query.data?.pages);

  return (
    <FlatList<Task>
      data={tasks}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TaskCard
          showOffers
          task={item}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })}
        />
      )}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() =>
        query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()
      }
      ListHeaderComponent={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {STATUS_FILTERS.map((f, i) => (
            <Chip
              key={f.label}
              label={f.label}
              selected={i === filterIndex}
              onPress={() => setFilterIndex(i)}
            />
          ))}
        </ScrollView>
      }
      ListEmptyComponent={
        query.isLoading ? (
          <View style={styles.skeletons}>
            <TaskCardSkeleton />
            <TaskCardSkeleton />
          </View>
        ) : query.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar tus tareas"
            actionLabel="Reintentar"
            onAction={() => void query.refetch()}
          />
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title={
              filterIndex === 0 ? 'Aún no has publicado tareas' : 'No hay tareas en este estado'
            }
            message={
              filterIndex === 0
                ? 'Cuando publiques una, aparecerá aquí con sus postulaciones.'
                : undefined
            }
            actionLabel={filterIndex === 0 ? 'Publicar una tarea' : undefined}
            onAction={filterIndex === 0 ? () => router.push('/publish') : undefined}
          />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={styles.footer} />
        ) : null
      }
    />
  );
}

function AppliedList() {
  const router = useRouter();
  const { colors } = useTheme();
  const query = useMyApplications();
  const applications = flatten(query.data?.pages);

  return (
    <FlatList<Application>
      data={applications}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => (
        <ApplicationRow
          application={item}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.task_id } })}
        />
      )}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() =>
        query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()
      }
      ListEmptyComponent={
        query.isLoading ? (
          <View style={styles.skeletons}>
            <TaskCardSkeleton />
            <TaskCardSkeleton />
          </View>
        ) : query.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar tus postulaciones"
            actionLabel="Reintentar"
            onAction={() => void query.refetch()}
          />
        ) : (
          <EmptyState
            icon="paper-plane-outline"
            title="Aún no te has postulado"
            message="Explora las tareas cercanas y postúlate a las que te interesen."
            actionLabel="Explorar tareas"
            onAction={() => router.push('/')}
          />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={styles.footer} />
        ) : null
      }
    />
  );
}

function ApplicationRow({
  application,
  onPress,
}: {
  application: Application;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Postulación a ${application.task.title}`}>
      <View style={styles.rowHead}>
        <Text variant="heading" level={2} numberOfLines={2} style={styles.flex}>
          {application.task.title}
        </Text>
        <Badge
          label={applicationStatusLabel[application.status]}
          tone={applicationStatusTone[application.status]}
        />
      </View>
      <Text variant="caption" tone="subtle">
        {application.task.poster_name} · te postulaste {timeAgo(application.created_at)}
      </Text>
      <View style={styles.rowFoot}>
        <Text variant="caption" tone="muted">
          Tu propuesta
        </Text>
        <View style={styles.amounts}>
          <Text variant="bodyStrong" tone="primary">
            {formatMoney(application.price_minor, application.currency)}
          </Text>
          <ConvertedAmount minor={application.price_minor} currency={application.currency} />
        </View>
      </View>
    </Card>
  );
}

function Separator() {
  return <View style={{ height: space.md }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  chips: { gap: space.sm, paddingBottom: space.lg },
  skeletons: { gap: space.md },
  footer: { paddingVertical: space.xl },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  amounts: { alignItems: 'flex-end' },
  rowFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
  },
});
