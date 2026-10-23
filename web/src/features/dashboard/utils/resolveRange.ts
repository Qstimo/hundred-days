import { shiftISODate, compareISODate } from '@/features/day/utils';
import { MAX_RANGE_DAYS, RangePreset } from '../constants';

/** Границы отрезка, включая оба края. */
export interface IRange {
  from: string;
  to: string;
}

/** Период, от которого считается пресет «весь период». */
export interface IPeriodBounds {
  start: string;
  days: number;
}

/**
 * Превращает пресет в границы отрезка.
 *
 * Конец никогда не уходит в будущее: данных за будущее нет, и запрашивать
 * их значило бы рисовать пустой хвост. Начало не уходит раньше начала
 * периода у пресета «весь период» и ограничено пределом длины у «всё
 * время» — сервер отвергает отрезки длиннее 400 дней, и упереться в это
 * лучше здесь, чем ответом с отказом.
 */
export function resolveRange(
  preset: RangePreset,
  today: string,
  period: IPeriodBounds,
): IRange {
  const to = earlier(today, periodEndISO(period));

  switch (preset) {
    case RangePreset.Days30:
      return { from: shiftISODate(to, -29), to };

    case RangePreset.Days90:
      return { from: shiftISODate(to, -89), to };

    case RangePreset.Period:
      return { from: period.start, to: later(period.start, to) };

    case RangePreset.All:
      // «Всё время» упирается в предел: иначе длинный период дал бы запрос,
      // который сервер отвергнет.
      return { from: later(period.start, shiftISODate(to, -(MAX_RANGE_DAYS - 1))), to };
  }
}

/** Последний день периода, включительно. */
function periodEndISO(period: IPeriodBounds): string {
  return shiftISODate(period.start, Math.max(0, period.days - 1));
}

function earlier(a: string, b: string): string {
  return compareISODate(a, b) <= 0 ? a : b;
}

function later(a: string, b: string): string {
  return compareISODate(a, b) >= 0 ? a : b;
}
