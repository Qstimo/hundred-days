import { describe, expect, it } from 'vitest';
import { periodEnd } from './periodEnd';

describe('periodEnd', () => {
  // Последний день входит в период: сто дней от 1 октября кончаются
  // 8 января, а не 9-го.
  it('считает последний день включительно', () => {
    expect(periodEnd('2026-10-01', 100)).toBe('2027-01-08');
    expect(periodEnd('2026-10-01', 1)).toBe('2026-10-01');
    expect(periodEnd('2026-10-01', 2)).toBe('2026-10-02');
  });

  it('переходит через границу года', () => {
    expect(periodEnd('2026-12-30', 5)).toBe('2027-01-03');
  });

  it('негодная дата даёт отсутствие результата', () => {
    expect(periodEnd('вчера', 100)).toBeNull();
    expect(periodEnd('', 100)).toBeNull();
  });

  it('негодная длительность даёт отсутствие результата', () => {
    expect(periodEnd('2026-10-01', 0)).toBeNull();
    expect(periodEnd('2026-10-01', -5)).toBeNull();
    expect(periodEnd('2026-10-01', 1.5)).toBeNull();
  });
});
