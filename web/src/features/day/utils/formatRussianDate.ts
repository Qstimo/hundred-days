import { DAY_FORMS, plural } from '@/lib/plural';

const WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
] as const;

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

/**
 * Разбирает «ГГГГ-ММ-ДД» в числа.
 *
 * Руками, а не через `new Date(строка)`: конструктор от строки такого вида
 * даёт полночь UTC, и в зоне +03 дата съезжает на день назад — «1 января»
 * показалось бы «31 декабря». Ошибка тихая и обнаруживается не сразу.
 */
function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/**
 * День недели по дате. Считается через конструктор от чисел, а не от
 * строки: у этого конструктора нет зонального сдвига.
 */
function weekdayOf(iso: string): string {
  const { year, month, day } = parseISODate(iso);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

/**
 * Дата по-русски. Сегодня и вчера называются словами: в них человек
 * ориентируется быстрее, чем в числе.
 */
export function formatRussianDate(iso: string, today?: string): string {
  const { month, day } = parseISODate(iso);
  const dayMonth = `${day} ${MONTHS_GENITIVE[month - 1]}`;

  if (today) {
    if (iso === today) return `Сегодня, ${dayMonth}`;
    if (iso === shiftISODate(today, -1)) return `Вчера, ${dayMonth}`;
  }

  return `${dayMonth}, ${weekdayOf(iso)}`;
}

/** Остаток периода словами, со склонением. */
export function formatDaysLeft(days: number): string {
  if (days <= 0) return 'период завершён';

  const verb = plural(days, DAY_FORMS) === 'день' ? 'остался' : 'осталось';
  return `${verb} ${days} ${plural(days, DAY_FORMS)}`;
}

/** Сдвигает дату на столько дней, сохраняя вид «ГГГГ-ММ-ДД». */
export function shiftISODate(iso: string, days: number): string {
  const { year, month, day } = parseISODate(iso);
  const shifted = new Date(year, month - 1, day + days);

  return [
    shifted.getFullYear(),
    String(shifted.getMonth() + 1).padStart(2, '0'),
    String(shifted.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Сравнивает даты. Строками, без разбора: вид «ГГГГ-ММ-ДД» устроен так, что
 * лексикографический порядок совпадает с хронологическим.
 */
export function compareISODate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
