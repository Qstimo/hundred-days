import { apiClient } from '@/api-client';
import type { IRegisterValues } from '../RegisterForm';

/** Сообщения отказа по машинному поводу от сервера. */
const MESSAGES: Record<string, string> = {
  registration_closed: 'Регистрация закрыта: аккаунт уже существует',
  login_taken: 'Такой логин занят',
  password: 'Пароль короче восьми знаков',
  login: 'Логин не может быть пустым',
};

/**
 * Создаёт первый аккаунт. Сервер сразу выдаёт cookie сессии, поэтому
 * отдельного входа после регистрации не нужно.
 *
 * Текст отказа берётся по машинному поводу, а не из сообщения сервера:
 * иначе интерфейс пересказывал бы серверные формулировки и расходился с
 * ними при любой правке.
 */
export async function register(values: IRegisterValues): Promise<void> {
  const { error } = await apiClient.POST('/auth/register', { body: values });
  if (!error) return;

  const code = (error as { code?: string }).code;
  throw new Error(MESSAGES[code ?? ''] ?? 'Не вышло создать аккаунт');
}

/** Открыта ли регистрация. */
export async function isRegistrationOpen(): Promise<boolean> {
  const { data } = await apiClient.GET('/auth/registration');
  return data?.isOpen ?? false;
}
