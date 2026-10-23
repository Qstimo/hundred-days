import type { IProps } from './types';

/**
 * Плитка показателя.
 *
 * Одно число графиком не рисуется: диаграмма из одного столбика — самый
 * частый способ промахнуться мимо смысла. Число здесь и есть график.
 *
 * Цифры пропорциональные, не моноширинные: у крупного числа одинаковая
 * ширина знаков выглядит разреженной. Моноширинные остаются таблицам.
 */
export function StatTile({ label, value, hint }: IProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
