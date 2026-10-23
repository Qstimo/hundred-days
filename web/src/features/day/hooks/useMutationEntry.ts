import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import { applyEntryLocally } from './applyEntryLocally';
import { dayQueryKey } from './useQueryDay';
import type { DayResponse, IEntryIntent } from './types';

/**
 * Ставит или снимает отметку выполнения.
 *
 * Обновление оптимистичное: галочка — одно нажатие, и ждать ответа сервера,
 * чтобы она закрасилась, значит сделать экран вязким. При отказе кэш
 * возвращается к снимку, снятому до запроса.
 */
export function useMutationEntry(date: string) {
  const queryClient = useQueryClient();
  const key = dayQueryKey(date);

  return useMutation({
    mutationFn: async (intent: IEntryIntent) => {
      const params = { path: { id: intent.trackerId, date } };

      const { error } = intent.done
        ? await apiClient.PUT('/trackers/{id}/entries/{date}', {
            params,
            body: { hours: intent.hours },
          })
        : await apiClient.DELETE('/trackers/{id}/entries/{date}', { params });

      if (error) throw error;
    },

    onMutate: async (intent) => {
      // Текущие запросы отменяются: ответ, пришедший после нашей правки,
      // затёр бы её старыми данными.
      await queryClient.cancelQueries({ queryKey: key });

      const snapshot = queryClient.getQueryData<DayResponse>(key);
      queryClient.setQueryData<DayResponse>(key, (prev) =>
        applyEntryLocally(prev, intent),
      );

      return { snapshot };
    },

    onError: (_error, _intent, context) => {
      // Возврат к снимку: иначе экран остался бы показывать сделанным то,
      // чего на сервере нет.
      if (context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot);
      }
    },

    onSettled: () => {
      // Поинты и недельный счёт считает сервер — после записи данные
      // перечитываются, а не досчитываются на месте.
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
