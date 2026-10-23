import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import { dayQueryKey } from './useQueryDay';
import type { Sleep } from './types';

/** Что можно записать про сон. Длительность считает сервер. */
export type SleepInput = Pick<Sleep, 'wentToBedAt' | 'wokeUpAt' | 'quality'>;

/**
 * Записывает сон за день.
 *
 * Без оптимистичного обновления: длительность считает сервер по правилу
 * перехода через полночь, и показать её до ответа значило бы повторить это
 * правило на клиенте — второе место, где оно может разойтись с первым.
 */
export function useMutationSleep(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SleepInput) => {
      const { error } = await apiClient.PUT('/sleep/{date}', {
        params: { path: { date } },
        body: input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dayQueryKey(date) });
    },
  });
}
