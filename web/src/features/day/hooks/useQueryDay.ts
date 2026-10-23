import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { DayResponse } from './types';

/**
 * Ключ запроса дня. Дата входит в ключ: дни кэшируются поотдельности, и
 * переход по стрелке не стирает уже загруженный соседний день.
 *
 * Пустая дата означает «сегодня по серверу» и ключуется отдельно от любой
 * конкретной: сервер сам решает, какой это день.
 */
export function dayQueryKey(date?: string) {
  return ['day', date ?? 'today'] as const;
}

/** Данные страницы дня одним запросом. */
export function useQueryDay(date?: string, initialData?: DayResponse) {
  return useQuery({
    queryKey: dayQueryKey(date),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/day', {
        params: { query: date ? { date } : {} },
      });
      if (error) throw error;
      return data;
    },
    initialData,
  });
}
