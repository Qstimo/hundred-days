/**
 * Три формы слова для склонения по числу: «день», «дня», «дней».
 *
 * Кортеж, а не объект: порядок форм в русском языке один и тот же, и имена
 * вроде `one`/`few`/`many` ничего не добавили бы, кроме повода их путать.
 */
export type PluralForms = readonly [one: string, few: string, many: string];

export const DAY_FORMS: PluralForms = ['день', 'дня', 'дней'];
export const WEEK_FORMS: PluralForms = ['неделя', 'недели', 'недель'];
export const POINT_FORMS: PluralForms = ['поинт', 'поинта', 'поинтов'];
export const TIME_FORMS: PluralForms = ['раз', 'раза', 'раз'];
export const HOUR_FORMS: PluralForms = ['час', 'часа', 'часов'];
export const PLAN_FORMS: PluralForms = ['пункт', 'пункта', 'пунктов'];

/**
 * Выбирает форму слова по числу.
 *
 * Правило: 1, 21, 31 — первая форма; 2–4, 22–24 — вторая; остальное —
 * третья. Числа от 11 до 14 — исключение и всегда берут третью форму,
 * именно на них ломаются реализации «по последней цифре».
 *
 * Дробное число склоняется по целой части: «1.5 поинта» — не «поинтов».
 */
export function plural(count: number, forms: PluralForms): string {
  const n = Math.floor(Math.abs(count));
  const lastTwo = n % 100;
  const last = n % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** Число вместе со склонённым словом: «5 дней». */
export function withPlural(count: number, forms: PluralForms): string {
  return `${count} ${plural(count, forms)}`;
}
