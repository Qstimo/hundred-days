import { describe, expect, it } from 'vitest';
import { cellShade } from './cellShade';
import { RAMP_STEPS } from '../constants';

describe('cellShade', () => {
  // Цель недельная, и ровный серый квадрат в субботу не ошибка.
  it('невыполненный день не красит провалом', () => {
    expect(cellShade(0, 5)).toBe('var(--muted)');
    expect(cellShade(-1, 5)).toBe('var(--muted)');
  });

  it('больше — темнее', () => {
    const low = cellShade(1, 10);
    const high = cellShade(10, 10);

    expect(RAMP_STEPS.indexOf(high as never)).toBeGreaterThan(
      RAMP_STEPS.indexOf(low as never),
    );
  });

  it('максимум берёт самый тёмный шаг', () => {
    expect(cellShade(10, 10)).toBe(RAMP_STEPS[RAMP_STEPS.length - 1]);
  });

  it('наименьшее ненулевое берёт самый светлый шаг', () => {
    expect(cellShade(1, 100)).toBe(RAMP_STEPS[0]);
  });

  it('нулевой максимум не делит на ноль', () => {
    expect(cellShade(1, 0)).toBe(RAMP_STEPS[0]);
  });

  it('значение сверх максимума не выходит за шкалу', () => {
    expect(cellShade(20, 10)).toBe(RAMP_STEPS[RAMP_STEPS.length - 1]);
  });

  it('шкала покрывает все шаги на равномерной величине', () => {
    const used = new Set(
      Array.from({ length: 5 }, (_, i) => cellShade(i + 1, 5)),
    );

    expect(used.size).toBe(RAMP_STEPS.length);
  });
});
