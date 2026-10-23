import { requireUser } from '@/features/auth/server';
import { createServerClient } from '@/api-client/serverClient';
import { DayScreen } from '@/features/day/DayScreen';

/**
 * Главная — страница сегодняшнего дня.
 *
 * Данные берутся на сервере и передаются экрану начальными: первая отрисовка
 * приходит заполненной, без индикатора загрузки. Дальше экран живёт на
 * TanStack Query — он единственный источник правды, и в состояние
 * компонента эти данные не копируются.
 *
 * Дата по умолчанию здесь не считается: какой день сегодняшний, решает
 * сервер по своей зоне, и второе место, где это решается, разошлось бы с
 * первым.
 */
export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();

  const { date } = await searchParams;
  const client = await createServerClient();
  const { data, error } = await client.GET('/day', {
    params: { query: date ? { date } : {} },
  });

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p role="alert">Не вышло загрузить день. Обновите страницу.</p>
      </main>
    );
  }

  return <DayScreen initialDay={data} date={date} />;
}
