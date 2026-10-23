'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDayMonth } from '@/features/day/utils';
import { formatDuration } from '@/features/day/SleepBlock/utils';
import { AXIS_PROPS, AXIS_COLOR, GRID_COLOR, LINE_WIDTH, seriesColor } from '../chartChrome';
import type { IProps } from './types';

/** Ориентир: восемь часов. Не оценка, а отметка на шкале. */
const REFERENCE_HOURS = 8;

/**
 * Длительность сна по дням.
 *
 * Отдельный график, а не вторая ось у времён отхода и подъёма: часы и время
 * суток — разные шкалы, и совмещение их на одном поле выдумало бы связь,
 * которой в данных нет. Ось дат у графиков общая, и читаются они вместе.
 *
 * Одна серия — легенды нет: заголовок карточки уже говорит, что отложено.
 * Заливка — тон серии примерно в десятую долю силы, то есть размывка, а не
 * плотный блок.
 */
export function SleepDurationChart({ sleep }: IProps) {
  const points = sleep
    .filter((s) => s.durationMinutes != null)
    .map((s) => ({ date: s.date, hours: (s.durationMinutes ?? 0) / 60 }));

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Длительности нет: нужны оба времени — и отхода, и подъёма
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={formatDayMonth}
          minTickGap={24}
          {...AXIS_PROPS}
        />
        <YAxis width={32} {...AXIS_PROPS} />

        <ReferenceLine
          y={REFERENCE_HOURS}
          stroke={AXIS_COLOR}
          label={{ value: '8 ч', position: 'right', fill: 'var(--chart-muted-ink)', fontSize: 11 }}
        />

        <Tooltip
          formatter={(value) => formatDuration(Math.round(Number(value) * 60))}
          labelFormatter={(label) => formatDayMonth(String(label))}
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />

        <Area
          dataKey="hours"
          stroke={seriesColor(1)}
          strokeWidth={LINE_WIDTH}
          fill={seriesColor(1)}
          fillOpacity={0.1}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
