import 'server-only';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/api-client/serverClient';

/**
 * Проверяет сессию в серверном компоненте и отдаёт пользователя.
 *
 * Без сессии уводит на вход — на сервере, до отрисовки: иначе защищённый
 * экран успел бы мигнуть содержимым, прежде чем клиент сообразит, что входа
 * нет.
 */
export async function requireUser() {
  const client = await createServerClient();
  const { data, error } = await client.GET('/auth/me');

  if (error || !data) redirect('/login');
  return data;
}
