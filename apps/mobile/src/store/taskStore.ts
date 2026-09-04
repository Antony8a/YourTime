import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TaskDTO } from '@yourtime/shared-types';

interface TaskState {
  tasks: TaskDTO[];
  loading: boolean;
  error: string | null;
  loadTasks: (filters?: any) => Promise<void>;
  applyToTask: (taskId: string, data: any) => Promise<void>;
  optimisticApply: (taskId: string) => void;
  rollbackApply: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      loading: false,
      error: null,

      loadTasks: async (filters) => {
        set({ loading: true, error: null });
        try {
          // TODO: Replace with actual API call
          // const response = await taskApi.listTasks(filters);
          // set({ tasks: response.data, loading: false });
          set({ loading: false });
        } catch (err: any) {
          set({ error: err.message, loading: false });
        }
      },

      applyToTask: async (taskId, data) => {
        get().optimisticApply(taskId);
        try {
          // await taskApi.applyToTask(taskId, data);
        } catch (err) {
          get().rollbackApply(taskId);
          throw err;
        }
      },

      optimisticApply: (taskId) => set(state => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, applications_count: t.applications_count + 1 } : t
        ),
      })),

      rollbackApply: (taskId) => set(state => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, applications_count: Math.max(0, t.applications_count - 1) } : t
        ),
      })),
    }),
    { name: 'task-storage', partialize: state => ({ tasks: state.tasks }) }
  )
);