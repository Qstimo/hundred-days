import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import { TRACKERS_KEY } from './useQueryTrackers';
import type { TrackerInput } from './types';

/**
 * Правки трекеров.
 *
 * После каждой правки перечитываются и трекеры, и день: отметки на странице
 * дня показывают цену и недельную цель трекера, и они только что могли
 * измениться.
 */
export function useMutationTracker() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: TRACKERS_KEY });
    void queryClient.invalidateQueries({ queryKey: ['day'] });
  };

  const create = useMutation({
    mutationFn: async (body: TrackerInput) => {
      const { error } = await apiClient.POST('/trackers', { body });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: TrackerInput }) => {
      const { error } = await apiClient.PUT('/trackers/{id}', {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await apiClient.DELETE('/trackers/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
