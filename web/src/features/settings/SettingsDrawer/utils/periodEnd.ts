import { shiftISODate } from '@/features/day/utils';

/**
 * Дата окончания периода по его началу и длительности.
 *
 * Последний день входит в период, поэтому сдвиг на длительность минус один:
 * период с 1 октября на сто дней кончается 8 января, а не 9-го.
 *
 * Нужна подсказкой в форме: «сто дней от 23 октября» — не та информация,
 * которую человек держит в голове.
 */
export function periodEnd(start: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  if (!Number.isInteger(days) || days < 1) return null;

  return shiftISODate(start, days - 1);
}
