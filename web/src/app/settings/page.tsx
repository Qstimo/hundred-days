import { requireUser } from '@/features/auth/server';
import { createServerClient } from '@/api-client/serverClient';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

/** Экран настроек периода. Настройки берутся на сервере. */
export default async function SettingsPage() {
  await requireUser();

  const client = await createServerClient();
  const { data, error } = await client.GET('/settings');

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p role="alert">Не вышло загрузить настройки. Обновите страницу.</p>
      </main>
    );
  }

  return <SettingsScreen initialSettings={data} />;
}
