import { describe, expect, it } from 'vitest';
import { MAX_SERIES, OTHER_LABEL, buildHoursSeries } from './buildHoursSeries';
import type { StatsTracker } from '../../hooks';

function tracker(
  title: string,
  hoursByDay: Array<number | null>,
  mode: 'check' | 'check_hours' = 'check_hours',
): StatsTracker {
  return {
    trackerId: title.length,
    title,
    mode,
    weeklyTarget: 3,
    days: hoursByDay.map((h, i) => ({
      date: `2026-10-${String(19 + i).padStart(2, '0')}`,
      done: h != null,
      hours: h,
      points: h ?? 0,
    })),
    totalDone: hoursByDay.filter((h) => h != null).length,
    totalHours: hoursByDay.reduce<number>((sum, h) => sum + (h ?? 0), 0),
    totalPoints: 0,
    completionRate: 1,
    currentStreak: 0,
    bestStreak: 0,
    currentWeekDone: 0,
  };
}

describe('buildHoursSeries', () => {
  it('собирает точки по датам', () => {
    const { series, points } = buildHoursSeries([tracker('Чтение', [1.5, 2])]);

    expect(series).toEqual([{ name: 'Чтение', slot: 1 }]);
    expect(points).toEqual([
      { date: '2026-10-19', Чтение: 1.5 },
      { date: '2026-10-20', Чтение: 2 },
    ]);
  });

  // У трекера с одной галочкой часов нет, и нулевая серия добавила бы в
  // легенду пустое имя.
  it('берёт только трекеры с часами', () => {
    const { series } = buildHoursSeries([
      tracker('Чтение', [1]),
      tracker('Зарядка', [1], 'check'),
    ]);

    expect(series.map((s) => s.name)).toEqual(['Чтение']);
  });

  it('трекер с часами, но без наработанных часов не показывается', () => {
    const { series } = buildHoursSeries([tracker('Чтение', [null, null])]);

    expect(series).toEqual([]);
  });

  it('пустой список даёт пустой график', () => {
    expect(buildHoursSeries([])).toEqual({ series: [], points: [] });
  });

  it('незаполненный день даёт ноль, а не пропуск', () => {
    const { points } = buildHoursSeries([tracker('Чтение', [1.5, null, 2])]);

    expect(points[1]).toEqual({ date: '2026-10-20', Чтение: 0 });
  });

  // Девятый цвет не отличается от существующего при дальтонизме, и решать
  // «слишком много серий» новыми тонами нельзя.
  it('сворачивает хвост в «Другое»', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      tracker(`Трекер ${i}`, [6 - i]),
    );

    const { series, points } = buildHoursSeries(many);

    expect(series).toHaveLength(MAX_SERIES + 1);
    expect(series[series.length - 1].name).toBe(OTHER_LABEL);
    // Два последних по сумме часов: 1 и 2 — всего 3.
    expect(points[0][OTHER_LABEL]).toBe(3);
  });

  it('ровно четыре серии хвоста не создают', () => {
    const four = Array.from({ length: MAX_SERIES }, (_, i) =>
      tracker(`Трекер ${i}`, [4 - i]),
    );

    const { series } = buildHoursSeries(four);

    expect(series).toHaveLength(MAX_SERIES);
    expect(series.map((s) => s.name)).not.toContain(OTHER_LABEL);
  });

  it('слоты цвета идут по порядку и не повторяются', () => {
    const many = Array.from({ length: 6 }, (_, i) => tracker(`Т${i}`, [6 - i]));

    const slots = buildHoursSeries(many).series.map((s) => s.slot);

    expect(slots).toEqual([1, 2, 3, 4, 5]);
  });

  it('серии упорядочены по сумме часов, от большей', () => {
    const { series } = buildHoursSeries([
      tracker('Мало', [1]),
      tracker('Много', [5]),
    ]);

    expect(series.map((s) => s.name)).toEqual(['Много', 'Мало']);
  });
});
