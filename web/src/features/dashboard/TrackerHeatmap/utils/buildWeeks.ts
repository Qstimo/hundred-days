import type { components } from '@/api-client';

export type StatsDay = components['schemas']['StatsDay'];

/** Клетка сетки. null — место до начала или после конца отрезка. */
export type HeatCell = StatsDay | null;

/**
 * Раскладывает дни по столбцам-неделям, начиная с понедельника.
 *
 * Первая неделя добивается пустыми клетками спереди: без них вся сетка
 * встанет под чужими днями недели — отрезок, начавшийся в среду, сдвинет
 * столбец на два дня, и теплокарта начнёт врать молча. Последняя неделя
 * добивается пустыми клетками сзади по той же причине.
 *
 * Разбор даты идёт по числам: new Date('2026-01-01') даёт полночь UTC и в
 * зоне +03 съезжает на день назад.
 */
export function buildWeeks(days: readonly StatsDay[]): HeatCell[][] {
  if (days.length === 0) return [];

  const weeks: HeatCell[][] = [];
  let current: HeatCell[] = Array(weekdayIndex(days[0].date)).fill(null);

  for (const day of days) {
    current.push(day);

    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    weeks.push([...current, ...Array(7 - current.length).fill(null)]);
  }

  return weeks;
}

/** Номер дня недели от понедельника: 0 — понедельник, 6 — воскресенье. */
function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  // В JavaScript воскресенье — ноль, поэтому его надо увести в конец.
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}
