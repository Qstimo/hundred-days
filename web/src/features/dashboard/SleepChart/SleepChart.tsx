'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDayMonth } from '@/features/day/utils';
import {
  AXIS_PROPS,
  DOT_RADIUS,
  DOT_RING,
  GRID_COLOR,
  LINE_WIDTH,
  seriesColor,
} from '../chartChrome';
import { fromSleepAxis, toSleepAxis } from './utils';
import type { IProps } from './types';

/**
 * Время отхода ко сну и подъёма.
 *
 * Ось считается от полудня: на обычной оси 23:40 и 00:10 оказались бы на
 * противоположных концах, хотя между ними полчаса.
 *
 * Длительность сна здесь не рисуется — у неё своя шкала, и вторая ось на
 * одном поле выдумала бы связь, которой в данных нет. Длительность идёт
 * отдельным графиком с той же осью дат.
 *
 * Линия размыкается на днях без данных, а не прыгает через них: `connectNulls`
 * выключен нарочно.
 */
export function SleepChart({ sleep }: IProps) {
  const points = sleep.map((s) => ({
    date: s.date,
    bed: toSleepAxis(s.wentToBedAt),
    wake: toSleepAxis(s.wokeUpAt),
  }));

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Записей сна за отрезок нет</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={formatDayMonth}
          minTickGap={24}
          {...AXIS_PROPS}
        />
        <YAxis
          width={44}
          domain={['dataMin - 1', 'dataMax + 1']}
          tickFormatter={(v: number) => fromSleepAxis(v)}
          {...AXIS_PROPS}
        />

        <Tooltip
          formatter={(value) => fromSleepAxis(Number(value))}
          labelFormatter={(label) => formatDayMonth(String(label))}
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />

        <Legend iconType="line" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

        <Line
          name="Лёг"
          dataKey="bed"
          stroke={seriesColor(1)}
          strokeWidth={LINE_WIDTH}
          connectNulls={false}
          dot={{ r: DOT_RADIUS, strokeWidth: DOT_RING, stroke: 'var(--card)' }}
        />
        <Line
          name="Встал"
          dataKey="wake"
          stroke={seriesColor(2)}
          strokeWidth={LINE_WIDTH}
          connectNulls={false}
          dot={{ r: DOT_RADIUS, strokeWidth: DOT_RING, stroke: 'var(--card)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
