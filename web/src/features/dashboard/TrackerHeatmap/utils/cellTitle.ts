import { formatDayMonth } from '@/features/day/utils';
import { HOUR_FORMS, POINT_FORMS, withPlural } from '@/lib/plural';
import type { StatsDay } from './buildWeeks';
import type { HeatCell } from './buildWeeks';

/** Подпись клетки: дата и что в этот день было. */
export function cellTitle(cell: StatsDay, mode: string): string {
  const date = formatDayMonth(cell.date);
  if (!cell.done) return `${date}: не сделано`;

  const parts = [withPlural(cell.points, POINT_FORMS)];
  if (mode === 'check_hours' && cell.hours != null) {
    parts.unshift(withPlural(cell.hours, HOUR_FORMS));
  }
  return `${date}: ${parts.join(', ')}`;
}

/** Подписи месяцев: по первому столбцу, в котором месяц сменился. */
export function monthTicks(weeks: readonly HeatCell[][]): Array<{
  col: number;
  label: string;
}> {
  const ticks: Array<{ col: number; label: string }> = [];
  let lastMonth = '';

  weeks.forEach((week, col) => {
    const first = week.find((c) => c != null);
    if (!first) return;

    const month = first.date.slice(0, 7);
    if (month !== lastMonth) {
      ticks.push({ col, label: formatDayMonth(first.date).split(' ')[1] });
      lastMonth = month;
    }
  });

  return ticks;
}
