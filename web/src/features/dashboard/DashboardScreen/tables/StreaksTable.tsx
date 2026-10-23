import { DataTable } from '@/components/DataTable';
import { formatDayMonth } from '@/features/day/utils';
import { formatNumber } from '@/lib/plural';
import type { StatsTracker } from '../../hooks';

/** Серии таблицей: текущая, лучшая, процент. */
export function StreaksTable({ trackers }: { trackers: StatsTracker[] }) {
  return (
    <DataTable
      caption="Серии и выполнение по трекерам"
      rows={trackers}
      columns={[
        { header: 'Трекер', cell: (t) => t.title },
        { header: 'Текущая серия', cell: (t) => t.currentStreak, isNumeric: true },
        { header: 'Лучшая', cell: (t) => t.bestStreak, isNumeric: true },
        { header: 'На этой неделе', cell: (t) => `${t.currentWeekDone} из ${t.weeklyTarget}` },
        {
          header: 'Выполнение',
          cell: (t) => `${Math.round(t.completionRate * 100)}%`,
          isNumeric: true,
        },
      ]}
    />
  );
}
