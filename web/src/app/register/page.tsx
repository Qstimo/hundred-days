import { redirect } from 'next/navigation';
import { createServerClient } from '@/api-client/serverClient';
import { RegisterScreen } from '@/features/auth/RegisterScreen';

/**
 * Страница первого аккаунта.
 *
 * Если регистрация уже закрыта — уводит на вход, не показывая форму,
 * которая всё равно откажет. Проверка на сервере, до отрисовки: иначе форма
 * успела бы мигнуть.
 */
export default async function RegisterPage() {
  const client = await createServerClient();
  const { data } = await client.GET('/auth/registration');

  if (!data?.isOpen) redirect('/login');

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <RegisterScreen />
    </main>
  );
}
