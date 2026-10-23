import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { Tracker } from './types';

export const TRACKERS_KEY = ['trackers'] as const;

/**
 * Трекеры пользователя. Архивные не запрашиваются: у реестра свой вид.
 *
 * Начальные данные приходят с сервера: без них первая отрисовка показала бы
 * «трекеров пока нет» при непустом реестре — не задержка, а ложь.
 */
export function useQueryTrackers(initialData?: Tracker[]) {
  return useQuery({
    queryKey: TRACKERS_KEY,
    initialData,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/trackers');
      if (error) throw error;
      return data;
    },
  });
}
