import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import { SKILLS_KEY } from './useQuerySkills';
import { TRACKERS_KEY } from './useQueryTrackers';
import type { SkillInput } from './types';

/**
 * Правки навыков.
 *
 * Удаление навыка снимает ссылку у его трекеров, поэтому перечитываются и
 * они, и день: короткий прогресс навыков на странице дня тоже изменился.
 */
export function useMutationSkill() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: SKILLS_KEY });
    void queryClient.invalidateQueries({ queryKey: TRACKERS_KEY });
    void queryClient.invalidateQueries({ queryKey: ['day'] });
  };

  const create = useMutation({
    mutationFn: async (body: SkillInput) => {
      const { error } = await apiClient.POST('/skills', { body });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: SkillInput }) => {
      const { error } = await apiClient.PUT('/skills/{id}', {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await apiClient.DELETE('/skills/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
