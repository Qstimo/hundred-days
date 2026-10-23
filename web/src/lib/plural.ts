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
 * Правило для целых: 1, 21, 31 — первая форма; 2–4, 22–24 — вторая;
 * остальное — третья. Числа от 11 до 14 — исключение и всегда берут третью
 * форму, именно на них ломаются реализации «по последней цифре».
 *
 * Дробное число всегда берёт вторую форму — родительный падеж
 * единственного числа: «1,5 поинта», «2,5 поинта», «0,5 поинта». Склонять
 * по целой части нельзя: получилось бы «1,5 поинт».
 */
export function plural(count: number, forms: PluralForms): string {
  const abs = Math.abs(count);

  if (!Number.isInteger(abs)) return forms[1];

  const lastTwo = abs % 100;
  const last = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/**
 * Число по-русски: разделитель дробной части — запятая, лишние нули не
 * пишутся.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

/** Число вместе со склонённым словом: «5 дней», «1,5 поинта». */
export function withPlural(count: number, forms: PluralForms): string {
  return `${formatNumber(count)} ${plural(count, forms)}`;
}
