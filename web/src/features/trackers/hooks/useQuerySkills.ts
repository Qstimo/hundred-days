import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';

export const SKILLS_KEY = ['skills'] as const;

/** Навыки пользователя. */
export function useQuerySkills() {
  return useQuery({
    queryKey: SKILLS_KEY,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/skills');
      if (error) throw error;
      return data;
    },
  });
}
