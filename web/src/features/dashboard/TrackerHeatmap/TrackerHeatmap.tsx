'use client';

import { HeatLegend } from './HeatLegend';
import {
  CELL,
  GAP,
  LABEL_WIDTH,
  MONTH_HEIGHT,
  STEP,
  WEEKDAY_LABELS,
} from './constants';
import { buildWeeks, cellShade, cellTitle, monthTicks } from './utils';
import type { IProps } from './types';

/**
 * Теплокарта дней трекера.
 *
 * Своим SVG, а не Recharts: календарная сетка — не график, а раскладка, и
 * библиотеке графиков её взять неоткуда.
 *
 * Клетки разделяет зазор поверхностью, а не обводка: обводка добавила бы
 * чернил, которые не данные. Каждая клетка несёт `<title>` с датой и
 * результатом — подсказка без своего обработчика, доступная и с клавиатуры.
 * Значение при этом не заперто в подсказке: у графика есть табличный вид.
 */
export function TrackerHeatmap({ tracker }: IProps) {
  const weeks = buildWeeks(tracker.days);
  const maxPoints = Math.max(...tracker.days.map((d) => d.points), 0);

  const width = LABEL_WIDTH + weeks.length * STEP;
  const height = MONTH_HEIGHT + 7 * STEP;

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Теплокарта: ${tracker.title}, выполнено ${tracker.totalDone} из ${tracker.days.length} дней`}
        className="block"
      >
        {WEEKDAY_LABELS.map((label, row) =>
          label ? (
            <text
              key={row}
              x={0}
              y={MONTH_HEIGHT + row * STEP + CELL - 2}
              className="fill-chart-muted-ink text-[10px]"
            >
              {label}
            </text>
          ) : null,
        )}

        {weeks.map((week, col) =>
          week.map((cell, row) => {
            if (!cell) return null;

            const x = LABEL_WIDTH + col * STEP;
            const y = MONTH_HEIGHT + row * STEP;

            return (
              <rect
                key={cell.date}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill={cellShade(cell.points, maxPoints)}
                tabIndex={0}
                className="focus:outline-2 focus:outline-offset-1 focus:outline-primary"
              >
                <title>{cellTitle(cell, tracker.mode)}</title>
              </rect>
            );
          }),
        )}

        {monthTicks(weeks).map((tick) => (
          <text
            key={tick.label + tick.col}
            x={LABEL_WIDTH + tick.col * STEP}
            y={MONTH_HEIGHT - 5}
            className="fill-chart-muted-ink text-[10px]"
          >
            {tick.label}
          </text>
        ))}
      </svg>

      <HeatLegend />
    </div>
  );
}
