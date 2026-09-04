import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useTasks } from '../../src/hooks/useTasks';
import { TaskCard } from '../components/task/TaskCard';
import { TaskFilter } from '../components/task/TaskFilter';
import { Button, Card, Spinner, EmptyState } from '../components/ui';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { tasks, loading, refreshing, loadMore, hasMore, applyToTask } = useTasks();

  const handleRefresh = async () => {
    await refreshing();
  };

  if (loading && tasks.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={handleRefresh} colors={['#3B82F6']} />
      }
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>¡Hola!</Text>
          <Text style={styles.subtitle}>Encuentra tareas cerca de ti</Text>
        </View>
        <View style={styles.headerRight}>
          <Button title="Filtrar" variant="outline" onPress={() => {}} icon={<Ionicons name="filter-outline" size={20} />} />
        </View>
      </View>

      {tasks.length === 0 ? (
        <EmptyState
          title="No hay tareas disponibles"
          description="Sé el primero en crear una tarea o vuelve más tarde"
          icon="briefcase-outline"
          actionLabel="Crear tarea"
          onAction={() => {}}
        />
      ) : (
        <>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => {}}
              onApply={(id) => applyToTask(id, { proposed_tokens: task.budget_min_tokens, message: '' })}
            />
          ))}
          {hasMore && (
            <Button
              title="Cargar más"
              variant="outline"
              onPress={loadMore}
              loading={loading}
              className="mt-4"
            />
          )}
        </>
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 16,
  },
});