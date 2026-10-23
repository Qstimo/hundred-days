import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client';
import type { components } from '@/api-client';

export type Settings = components['schemas']['Settings'];
export type SettingsResponse = components['schemas']['SettingsResponse'];

export const SETTINGS_KEY = ['settings'] as const;

/** Настройки вместе с вычисленным периодом. Начальные данные — с сервера. */
export function useQuerySettings(initialData?: SettingsResponse) {
  return useQuery({
    queryKey: SETTINGS_KEY,
    initialData,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/settings');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Запись настроек.
 *
 * После сохранения перечитывается и день: смена даты начала или длительности
 * меняет номер дня и остаток в шапке, а тумблер сна — состав экрана.
 */
export function useMutationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: Settings) => {
      const { error } = await apiClient.PUT('/settings', { body });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['day'] });
    },
  });
}
