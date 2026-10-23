import { apiClient } from '@/api-client';
import type { ILoginValues } from '../LoginForm';

/**
 * Входит по логину и паролю. Отказ бросается, чтобы форма показала
 * сообщение: различать причины отказа ей не нужно, да и сервер их не
 * различает.
 */
export async function login(values: ILoginValues): Promise<void> {
  const { error } = await apiClient.POST('/auth/login', { body: values });
  if (error) throw new Error('вход не удался');
}

/** Выходит и гасит cookie. Идемпотентен, как и на сервере. */
export async function logout(): Promise<void> {
  await apiClient.POST('/auth/logout');
}
