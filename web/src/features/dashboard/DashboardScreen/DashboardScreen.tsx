'use client';

import Link from 'next/link';
import { ChartCard } from '@/components/ChartCard';
import { HoursChart } from '../HoursChart';
import { RangePicker } from '../RangePicker';
import { SkillMeters } from '../SkillMeters';
import { StatTiles } from '../StatTiles';
import { TrackerHeatmap } from '../TrackerHeatmap';
import { useQueryStats } from '../hooks';
import { SleepSection } from './SleepSection';
import { StreaksSection } from './StreaksSection';
import { HeatmapTable, HoursTable, SkillsTable } from './tables';
import type { IProps } from './types';

/**
 * Дашборд.
 *
 * Переключатель отрезка — один ряд над всем содержимым, а не у каждого
 * графика: все числа на экране считаются по одному срезу и всегда
 * согласуются между собой.
 *
 * У каждого графика есть табличный двойник, переключаемый кнопкой в его
 * карточке. Это условие, а не удобство: в светлой теме два слота палитры
 * дают к белому меньше 3:1, и значение не должно быть заперто в цвете.
 */
export function DashboardScreen({ initialStats, preset, from, to }: IProps) {
  const { data, isFetching } = useQueryStats(from, to, initialStats);
  const stats = data ?? initialStats;

  const rangeDays =
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
    ) + 1;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-24 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Статистика</h1>
        <Link href="/" className="text-sm underline">
          К сегодняшнему дню
        </Link>
      </div>

      <RangePicker value={preset} from={from} to={to} />

      <StatTiles stats={stats} rangeDays={rangeDays} />

      <StreaksSection trackers={stats.trackers} isRefreshing={isFetching} />

      {stats.trackers.map((tracker) => (
        <ChartCard
          key={tracker.trackerId}
          title={tracker.title}
          hint={`сделано ${tracker.totalDone} из ${rangeDays} дней`}
          isRefreshing={isFetching}
          table={<HeatmapTable tracker={tracker} />}
        >
          <TrackerHeatmap tracker={tracker} />
        </ChartCard>
      ))}

      <ChartCard
        title="Прогресс навыков"
        hint="метка на дорожке — прогноз по темпу последних двух недель"
        isRefreshing={isFetching}
        table={<SkillsTable skills={stats.skills} />}
      >
        <SkillMeters skills={stats.skills} />
      </ChartCard>

      <ChartCard
        title="Часы по дням"
        hint="с разбивкой по трекерам"
        isRefreshing={isFetching}
        table={<HoursTable trackers={stats.trackers} />}
      >
        <HoursChart trackers={stats.trackers} />
      </ChartCard>

      <SleepSection sleep={stats.sleep} isRefreshing={isFetching} />
    </main>
  );
}
