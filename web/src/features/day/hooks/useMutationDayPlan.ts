import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import { dayQueryKey } from './useQueryDay';

/**
 * Правки планов на день: добавить, закрыть, переименовать, удалить и
 * подтянуть незакрытые со вчера.
 *
 * Оптимистичного обновления здесь нет нарочно. Отметка выполнения — одно
 * нажатие в длинном списке, и задержка там заметна; добавление пункта
 * сопровождается набором текста, а перенос меняет сразу несколько строк и
 * их идентификаторы, которые знает только сервер. Угадывать их на клиенте
 * значило бы показать список, который потом перестроится.
 */
export function useMutationDayPlan(date: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: dayQueryKey(date) });

  const create = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await apiClient.POST('/day-plans', {
        body: { date, title },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: async (input: { id: number; done?: boolean; title?: string }) => {
      const { id, ...body } = input;
      const { error } = await apiClient.PATCH('/day-plans/{id}', {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await apiClient.DELETE('/day-plans/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const carryOver = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST('/day-plans/carry-over', {
        body: { date },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, patch, remove, carryOver };
}
