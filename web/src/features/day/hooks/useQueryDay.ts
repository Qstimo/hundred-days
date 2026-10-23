import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { DayResponse } from './types';

/**
 * Ключ запроса дня — всегда по конкретной дате.
 *
 * Особого ключа «сегодня» нет нарочно, и это не мелочь. Пока он был, экран
 * главной читал кэш под «today», а мутации писали под разрешённую дату:
 * отметка уходила на сервер, но на экране не закрашивалась, и добавленный
 * пункт не появлялся до перезагрузки. Одна запись кэша на день — условие
 * того, чтобы запись и чтение сошлись.
 */
export function dayQueryKey(date: string) {
  return ['day', date] as const;
}

/**
 * Данные страницы дня одним запросом.
 *
 * Дата обязательна: её разрешает сервер и возвращает в ответе, а страница
 * передаёт сюда уже разрешённую. Второго места, где решается «какой сегодня
 * день», быть не должно.
 */
export function useQueryDay(date: string, initialData?: DayResponse) {
  return useQuery({
    queryKey: dayQueryKey(date),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/day', {
        params: { query: { date } },
      });
      if (error) throw error;
      return data;
    },
    initialData,
  });
}
