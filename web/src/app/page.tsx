import { requireUser } from '@/features/auth/server';

/**
 * Главная — страница дня. Пока заглушка: экран собирается в чанке 8.
 * Охрана сессии стоит уже здесь, чтобы она не оказалась добавленной потом.
 */
export default async function DayPage() {
  const user = await requireUser();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">100 дней до</h1>
      <p className="mt-2 text-muted-foreground">Вошли как {user.name || user.login}</p>
    </main>
  );
}
