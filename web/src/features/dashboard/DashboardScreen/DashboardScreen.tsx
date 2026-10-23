'use client';

import Link from 'next/link';
import { ChartCard } from '@/components/ChartCard';
import { HoursChart } from '../HoursChart';
import { RangePicker } from '../RangePicker';
import { SkillMeters } from '../SkillMeters';
import { SleepChart } from '../SleepChart';
import { SleepDurationChart } from '../SleepDurationChart';
import { StatTiles } from '../StatTiles';
import { TrackerHeatmap } from '../TrackerHeatmap';
import { useQueryStats } from '../hooks';
import {
  HeatmapTable,
  HoursTable,
  SkillsTable,
  SleepTable,
  StreaksTable,
} from './tables';
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

      {/* Таблицей, а не графиком: это не величина и не ряд, а несколько
          чисел на трекер. Переключателя «график / таблица» здесь нет —
          менять таблицу на таблицу незачем. */}
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">Серии и выполнение</h2>
          <p className="text-xs text-muted-foreground">
            серия считается по неделям: цель недельная
          </p>
        </div>
        <div className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
          <StreaksTable trackers={stats.trackers} />
        </div>
      </section>

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

      <ChartCard
        title="Когда лёг и когда встал"
        hint="ось считается от полудня, чтобы ночь шла непрерывно"
        isRefreshing={isFetching}
        table={<SleepTable sleep={stats.sleep} />}
      >
        <SleepChart sleep={stats.sleep} />
      </ChartCard>

      <ChartCard
        title="Сколько спал"
        hint="отдельным графиком: у часов своя шкала"
        isRefreshing={isFetching}
        table={<SleepTable sleep={stats.sleep} />}
      >
        <SleepDurationChart sleep={stats.sleep} />
      </ChartCard>
    </main>
  );
}
