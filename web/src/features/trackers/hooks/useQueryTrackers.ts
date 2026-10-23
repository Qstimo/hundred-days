import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';

export const TRACKERS_KEY = ['trackers'] as const;

/** Трекеры пользователя. Архивные не запрашиваются: у реестра свой вид. */
export function useQueryTrackers() {
  return useQuery({
    queryKey: TRACKERS_KEY,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/trackers');
      if (error) throw error;
      return data;
    },
  });
}
