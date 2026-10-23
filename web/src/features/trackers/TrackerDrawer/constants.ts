import type { PointsRule, TrackerMode } from '../hooks';

/** Режимы трекера с подписями. Вынесено из разметки по правилу проекта. */
export const MODE_OPTIONS: ReadonlyArray<{ value: TrackerMode; label: string }> = [
  { value: 'check', label: 'Только галочка' },
  { value: 'check_hours', label: 'Галочка и часы' },
];

/** Правила начисления с подписями. */
export const RULE_OPTIONS: ReadonlyArray<{ value: PointsRule; label: string }> = [
  { value: 'per_check', label: 'За выполнение' },
  { value: 'per_hour', label: 'За час' },
];

/** Возможные недельные цели. */
export const WEEKLY_TARGETS = [1, 2, 3, 4, 5, 6, 7] as const;
