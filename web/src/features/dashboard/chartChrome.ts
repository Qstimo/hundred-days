/**
 * Общий хром графиков: толщины, зазоры, цвета сетки.
 *
 * Собрано в одном месте, чтобы шесть графиков выглядели одним набором, а не
 * шестью разными. Данные — единственное, чему позволено быть громким.
 */

/** Толщина столбика. Не шире — пусть остаток полосы будет воздухом. */
export const BAR_MAX_WIDTH = 24;

/** Радиус скругления у конца столбика. У основания — прямой угол. */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** Толщина линии. */
export const LINE_WIDTH = 2;

/** Радиус точки на линии: меньше — в неё не прицелиться. */
export const DOT_RADIUS = 4;

/** Кольцо поверхностью вокруг точки, чтобы та читалась на пересечении. */
export const DOT_RING = 2;

/**
 * Зазор между соседними марками — поверхностью, а не обводкой.
 * Обводка добавила бы чернил, которые не данные.
 */
export const SURFACE_GAP = 2;

/** Цвета хрома. Сетка и оси — сплошные волосяные, не пунктир. */
export const GRID_COLOR = 'var(--chart-grid)';
export const AXIS_COLOR = 'var(--chart-axis)';
export const MUTED_INK = 'var(--chart-muted-ink)';

/** Слоты категориальной палитры. Порядок — сам механизм безопасности. */
export const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Цвет серии по её слоту, считая с единицы. */
export function seriesColor(slot: number): string {
  return SERIES_COLORS[(slot - 1) % SERIES_COLORS.length];
}

/** Общие свойства осей: волосяная линия, приглушённые подписи. */
export const AXIS_PROPS = {
  stroke: AXIS_COLOR,
  tick: { fill: MUTED_INK, fontSize: 11 },
  tickLine: false,
} as const;
