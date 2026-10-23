'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDayMonth } from '@/features/day/utils';
import {
  AXIS_PROPS,
  BAR_MAX_WIDTH,
  BAR_RADIUS,
  GRID_COLOR,
  seriesColor,
} from '../chartChrome';
import { buildHoursSeries } from './utils';
import type { IProps } from './types';

/**
 * Часы по дням, накопительными столбиками с разбивкой по трекерам.
 *
 * Легенда есть всегда при двух и более сериях: цвет не должен быть
 * единственным способом понять, где чей столбик. В светлой теме аква и
 * жёлтый дают к белому меньше 3:1, и это допустимо только с возмещением —
 * им служат легенда и табличный вид у карточки.
 *
 * Сегменты разделяет зазор поверхностью, а не обводка.
 */
export function HoursChart({ trackers }: IProps) {
  const { series, points } = buildHoursSeries(trackers);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Часов за отрезок нет: ни один трекер их не ведёт
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={formatDayMonth}
          minTickGap={24}
          {...AXIS_PROPS}
        />
        <YAxis width={32} {...AXIS_PROPS} />

        <Tooltip
          // Значение ведёт, подпись следует: читатель уже знает серию и
          // хочет число.
          formatter={(value) => `${value} ч`}
          labelFormatter={(label) => formatDayMonth(String(label))}
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />

        <Legend
          iconType="rect"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />

        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="hours"
            fill={seriesColor(s.slot)}
            maxBarSize={BAR_MAX_WIDTH}
            // Скругление только у верхнего сегмента: у нижних конец данных
            // упирается в основание, и там угол прямой.
            radius={i === series.length - 1 ? BAR_RADIUS : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
