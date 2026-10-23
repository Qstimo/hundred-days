import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { Skill } from './types';

export const SKILLS_KEY = ['skills'] as const;

/** Навыки пользователя. Начальные данные приходят с сервера. */
export function useQuerySkills(initialData?: Skill[]) {
  return useQuery({
    queryKey: SKILLS_KEY,
    initialData,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/skills');
      if (error) throw error;
      return data;
    },
  });
}
