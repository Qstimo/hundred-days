import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { components } from '@/api-client';

export type StatsResponse = components['schemas']['StatsResponse'];
export type StatsTracker = components['schemas']['StatsTracker'];
export type StatsSkill = components['schemas']['StatsSkill'];
export type StatsSleep = components['schemas']['StatsSleep'];

/** Ключ запроса статистики. Отрезок входит в ключ: он и есть запрос. */
export function statsQueryKey(from: string, to: string) {
  return ['stats', from, to] as const;
}

/**
 * Статистика за отрезок.
 *
 * placeholderData держит прежний ответ, пока грузится новый: при смене
 * отрезка графики остаются на месте приглушёнными, а не мигают скелетом.
 */
export function useQueryStats(from: string, to: string, initialData?: StatsResponse) {
  return useQuery({
    queryKey: statsQueryKey(from, to),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/stats', {
        params: { query: { from, to } },
      });
      if (error) throw error;
      return data;
    },
    initialData,
    placeholderData: (previous) => previous,
  });
}
