import { requireUser } from '@/features/auth/server';
import { createServerClient } from '@/api-client/serverClient';
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { RangePreset } from '@/features/dashboard/constants';
import { resolveRange } from '@/features/dashboard/utils';

/**
 * Дашборд.
 *
 * Отрезок разрешается на сервере: он нужен и для запроса статистики, и для
 * подписи переключателя, а считать его дважды — верный способ получить два
 * разных ответа.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireUser();

  const { range } = await searchParams;
  const preset = isPreset(range) ? range : RangePreset.Days30;

  const client = await createServerClient();
  const settings = await client.GET('/settings');

  if (settings.error || !settings.data) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p role="alert">Не вышло загрузить настройки. Обновите страницу.</p>
      </main>
    );
  }

  const { period } = settings.data;
  const { from, to } = resolveRange(preset, period.today, {
    start: period.start,
    days: period.days,
  });

  const stats = await client.GET('/stats', { params: { query: { from, to } } });

  if (stats.error || !stats.data) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p role="alert">Не вышло загрузить статистику. Обновите страницу.</p>
      </main>
    );
  }

  return (
    <DashboardScreen initialStats={stats.data} preset={preset} from={from} to={to} />
  );
}

function isPreset(value: string | undefined): value is RangePreset {
  return (Object.values(RangePreset) as string[]).includes(value ?? '');
}
