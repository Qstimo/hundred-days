import { describe, expect, it } from 'vitest';
import { fromSleepAxis, toSleepAxis } from './toSleepAxis';

describe('toSleepAxis', () => {
  // Суть графика: на обычной оси 23:40 и 00:10 оказываются на
  // противоположных концах, хотя между ними полчаса.
  it('ночное время идёт непрерывно через полночь', () => {
    const late = toSleepAxis('23:40')!;
    const early = toSleepAxis('00:10')!;

    expect(early - late).toBeCloseTo(0.5, 5);
  });

  it('вечер остаётся как есть', () => {
    expect(toSleepAxis('23:00')).toBe(23);
    expect(toSleepAxis('12:00')).toBe(12);
  });

  it('утро уходит за сутки', () => {
    expect(toSleepAxis('07:10')).toBeCloseTo(31.1667, 3);
    expect(toSleepAxis('00:00')).toBe(24);
  });

  it('полдень — точка отсчёта и за сутки не уходит', () => {
    expect(toSleepAxis('12:00')).toBe(12);
    expect(toSleepAxis('11:59')).toBeGreaterThan(24);
  });

  it('23:40 раньше 07:10 по этой оси', () => {
    expect(toSleepAxis('23:40')!).toBeLessThan(toSleepAxis('07:10')!);
  });

  it('пустое и негодное время — отсутствие значения', () => {
    expect(toSleepAxis(null)).toBeNull();
    expect(toSleepAxis(undefined)).toBeNull();
    expect(toSleepAxis('')).toBeNull();
    expect(toSleepAxis('полдень')).toBeNull();
    expect(toSleepAxis('7:10')).toBeNull();
    expect(toSleepAxis('25:00')).toBeNull();
    expect(toSleepAxis('12:60')).toBeNull();
  });
});

describe('fromSleepAxis', () => {
  it('возвращает время обратно', () => {
    expect(fromSleepAxis(23)).toBe('23:00');
    expect(fromSleepAxis(24)).toBe('00:00');
    expect(fromSleepAxis(31.5)).toBe('07:30');
  });

  it('переход туда и обратно не теряет значения', () => {
    for (const clock of ['23:40', '07:10', '00:00', '12:00', '19:45']) {
      expect(fromSleepAxis(toSleepAxis(clock)!)).toBe(clock);
    }
  });
});
