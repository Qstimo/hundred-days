import { RAMP_STEPS } from '../constants';

/**
 * Цвет клетки по величине.
 *
 * Невыполненный день не красится провалом — он берёт цвет поверхности:
 * цель недельная, и ровный серый квадрат в субботу не ошибка, а норма.
 *
 * Шаг выбирается по доле от максимума за отрезок, а не по абсолютному
 * значению: у трекера с часами величины совсем другого порядка, чем у
 * трекера с галочкой, и общая шкала сделала бы один из них однотонным.
 */
export function cellShade(points: number, maxPoints: number): string {
  if (points <= 0) return 'var(--muted)';
  if (maxPoints <= 0) return RAMP_STEPS[0];

  const share = points / maxPoints;
  const index = Math.min(
    RAMP_STEPS.length - 1,
    Math.floor(share * RAMP_STEPS.length - 1e-9),
  );

  return RAMP_STEPS[Math.max(0, index)];
}
