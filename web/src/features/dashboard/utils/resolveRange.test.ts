import { describe, expect, it } from 'vitest';
import { resolveRange } from './resolveRange';
import { RangePreset } from '../constants';

const today = '2026-10-23';
const period = { start: '2026-10-01', days: 100 };

describe('resolveRange', () => {
  it('тридцать дней считает назад от сегодня включительно', () => {
    expect(resolveRange(RangePreset.Days30, today, period)).toEqual({
      from: '2026-09-24',
      to: '2026-10-23',
    });
  });

  it('девяносто дней — так же', () => {
    expect(resolveRange(RangePreset.Days90, today, period)).toEqual({
      from: '2026-07-26',
      to: '2026-10-23',
    });
  });

  it('весь период берёт от его начала до сегодня', () => {
    expect(resolveRange(RangePreset.Period, today, period)).toEqual({
      from: '2026-10-01',
      to: '2026-10-23',
    });
  });

  // Данных за будущее нет, и запрашивать их значило бы рисовать пустой хвост.
  it('не уводит конец отрезка в будущее', () => {
    const range = resolveRange(RangePreset.Period, today, period);

    expect(range.to).toBe(today);
  });

  it('у кончившегося периода конец — его последний день, а не сегодня', () => {
    const past = { start: '2026-01-01', days: 30 };

    expect(resolveRange(RangePreset.Period, today, past)).toEqual({
      from: '2026-01-01',
      to: '2026-01-30',
    });
  });

  it('у не начавшегося периода отрезок не вырождается', () => {
    const future = { start: '2026-12-01', days: 100 };
    const range = resolveRange(RangePreset.Period, today, future);

    expect(range.from).toBe('2026-12-01');
    expect(range.to).toBe('2026-12-01');
  });

  it('всё время начинает с начала периода, когда он короче предела', () => {
    expect(resolveRange(RangePreset.All, today, period).from).toBe('2026-10-01');
  });

  // Сервер отвергает отрезки длиннее 400 дней — упереться в это лучше здесь.
  it('всё время упирается в предел длины', () => {
    const old = { start: '2020-01-01', days: 3000 };
    const range = resolveRange(RangePreset.All, today, old);

    const days =
      (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000 + 1;
    expect(days).toBe(400);
  });
});
