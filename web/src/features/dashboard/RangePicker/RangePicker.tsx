'use client';

import { useRouter } from 'next/navigation';
import { formatDayMonth } from '@/features/day/utils';
import { RANGE_LABELS, RANGE_ORDER, RangePreset } from '../constants';
import type { IProps } from './types';

/**
 * Переключатель отрезка.
 *
 * Один ряд над всем содержимым, а не у каждого графика: все графики и
 * плитки считаются по одному и тому же срезу, и числа на экране всегда
 * согласуются между собой.
 *
 * Выбор живёт в адресе: ссылкой на дашборд за три месяца должно быть можно
 * поделиться и вернуться к ней кнопкой «назад».
 */
export function RangePicker({ value, from, to }: IProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Отрезок" className="flex flex-wrap gap-1">
        {RANGE_ORDER.map((preset) => {
          const isSelected = preset === value;

          return (
            <button
              key={preset}
              type="button"
              aria-pressed={isSelected}
              onClick={() => router.push(`/dashboard?range=${preset}`)}
              className={
                isSelected
                  ? 'rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground'
                  : 'rounded-md px-3 py-1.5 text-sm hover:bg-muted'
              }
            >
              {isSelected && <span aria-hidden="true">✓ </span>}
              {RANGE_LABELS[preset]}
            </button>
          );
        })}
      </div>

      <span className="text-sm text-muted-foreground">
        {formatDayMonth(from)} — {formatDayMonth(to)}
      </span>
    </div>
  );
}

export { RangePreset };
