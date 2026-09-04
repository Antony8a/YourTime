import { useState, useCallback, useEffect } from 'react';
import { useTaskStore } from '../store/taskStore';
import { TaskDTO } from '@yourtime/shared-types';

export const useTasks = (filters?: any) => {
  const { tasks, loading, error, loadTasks, applyToTask } = useTaskStore();
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const filteredTasks = useCallback(() => {
    let result = tasks;
    if (filters?.categoryId) result = result.filter(t => t.category_id === filters.categoryId);
    if (filters?.status) result = result.filter(t => t.status === filters.status);
    return result;
  }, [tasks, filters]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setPage(p => p + 1);
    await loadTasks({ ...filters, cursor: page > 0 ? tasks[tasks.length - 1]?.id : undefined });
    if (tasks.length === 0) setHasMore(false);
  }, [loading, hasMore, tasks, filters]);

  const refreshing = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await loadTasks(filters);
  }, [loadTasks, filters]);

  useEffect(() => {
    if (tasks.length === 0 && !loading) {
      loadTasks(filters);
    }
  }, []);

  return {
    tasks: filteredTasks(),
    loading,
    error,
    hasMore,
    loadMore,
    refreshing,
    applyToTask,
  };
};