import { redirect } from 'next/navigation';
import { createServerClient } from '@/api-client/serverClient';
import { LoginScreen } from '@/features/auth/LoginScreen';

/**
 * Страница входа.
 *
 * Если сессия уже есть, уводит на главную: показывать форму вошедшему
 * незачем, а по ссылке на `/login` можно попасть и из закладки.
 */
export default async function LoginPage() {
  const client = await createServerClient();
  const [me, registration] = await Promise.all([
    client.GET('/auth/me'),
    client.GET('/auth/registration'),
  ]);

  if (me.data) redirect('/');

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <LoginScreen isRegistrationOpen={registration.data?.isOpen ?? false} />
    </main>
  );
}
