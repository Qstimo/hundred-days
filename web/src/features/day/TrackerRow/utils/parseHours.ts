/**
 * Разбирает часы из текста поля.
 *
 * Пустое и негодное — отсутствие значения, а не ноль: ноль часов означал бы
 * «спал нисколько», а здесь имелось в виду «не указано». Запятая
 * принимается наравне с точкой: по-русски дробная часть пишется запятой, и
 * заставлять переучиваться незачем.
 */
export function parseHours(text: string): number | null {
  if (text.trim() === '') return null;

  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
