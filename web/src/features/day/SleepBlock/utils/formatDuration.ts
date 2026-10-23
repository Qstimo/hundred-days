/**
 * Длительность сна словами: «7 ч 30 мин».
 *
 * Минуты не опускаются при нуле: «8 ч 0 мин» выглядит хуже, чем «8 ч»,
 * поэтому ровные часы пишутся без минут.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}
