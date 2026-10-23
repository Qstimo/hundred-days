/**
 * Переводит время суток в значение оси для графика сна.
 *
 * Ось считается от полудня: на обычной оси 23:40 и 00:10 оказываются на
 * противоположных концах, хотя между ними полчаса. Часы после полудня
 * остаются как есть, часы до полудня получают плюс сутки — и ночь
 * становится непрерывной.
 *
 * Отсчёт от полудня, а не от какого-то «начала ночи»: полдень — середина
 * бодрствования, и через него никто не засыпает.
 */
export function toSleepAxis(clock: string | null | undefined): number | null {
  if (!clock) return null;

  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const value = hours + minutes / 60;
  return value < 12 ? value + 24 : value;
}

/** Обратный перевод — для подписей оси. */
export function fromSleepAxis(value: number): string {
  const wrapped = value >= 24 ? value - 24 : value;
  const hours = Math.floor(wrapped);
  const minutes = Math.round((wrapped - hours) * 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
