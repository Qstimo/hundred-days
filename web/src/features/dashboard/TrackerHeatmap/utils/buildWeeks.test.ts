import { describe, expect, it } from 'vitest';
import { buildWeeks } from './buildWeeks';
import type { StatsDay } from './buildWeeks';

function day(date: string, done = false): StatsDay {
  return { date, done, points: done ? 1 : 0 };
}

describe('buildWeeks', () => {
  it('раскладывает дни по столбцам-неделям, начиная с понедельника', () => {
    // 19 октября 2026 — понедельник, 25-е — воскресенье.
    const days = [
      day('2026-10-19', true),
      day('2026-10-20'),
      day('2026-10-21', true),
      day('2026-10-22'),
      day('2026-10-23'),
      day('2026-10-24'),
      day('2026-10-25', true),
    ];

    const weeks = buildWeeks(days);

    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0][0]?.date).toBe('2026-10-19');
    expect(weeks[0][6]?.date).toBe('2026-10-25');
  });

  // Без пустых клеток в начале вся сетка встанет под чужими днями недели.
  it('добивает первую неделю пустыми клетками, если отрезок начался в середине', () => {
    // 21 октября — среда: две клетки до неё должны быть пустыми.
    const weeks = buildWeeks([day('2026-10-21', true)]);

    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBeNull();
    expect(weeks[0][2]?.date).toBe('2026-10-21');
    expect(weeks[0]).toHaveLength(7);
  });

  it('добивает последнюю неделю пустыми клетками сзади', () => {
    const weeks = buildWeeks([day('2026-10-19'), day('2026-10-20')]);

    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0][2]).toBeNull();
    expect(weeks[0][6]).toBeNull();
  });

  it('разбивает длинный отрезок на несколько недель', () => {
    const days = Array.from({ length: 21 }, (_, i) =>
      day(`2026-10-${String(5 + i).padStart(2, '0')}`, i % 2 === 0),
    );

    // 5 октября — понедельник, значит ровно три полные недели.
    expect(buildWeeks(days)).toHaveLength(3);
  });

  it('воскресенье попадает в конец недели, а не в начало следующей', () => {
    // 25 октября 2026 — воскресенье.
    const weeks = buildWeeks([day('2026-10-25', true)]);

    expect(weeks[0][6]?.date).toBe('2026-10-25');
    expect(weeks).toHaveLength(1);
  });

  it('пустой отрезок даёт пустую сетку', () => {
    expect(buildWeeks([])).toEqual([]);
  });

  it('все клетки каждой недели на месте', () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day(`2026-10-${String(14 + i).padStart(2, '0')}`),
    );

    for (const week of buildWeeks(days)) {
      expect(week).toHaveLength(7);
    }
  });
});
