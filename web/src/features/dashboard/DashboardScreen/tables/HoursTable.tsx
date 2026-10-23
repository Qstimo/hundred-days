import { DataTable } from '@/components/DataTable';
import { formatDayMonth } from '@/features/day/utils';
import { formatNumber } from '@/lib/plural';
import type { StatsTracker } from '../../hooks';

/** Часы таблицей: по трекерам за отрезок. */
export function HoursTable({ trackers }: { trackers: StatsTracker[] }) {
  const withHours = trackers.filter((t) => t.mode === 'check_hours');

  return (
    <DataTable
      caption="Часы по трекерам"
      rows={withHours}
      columns={[
        { header: 'Трекер', cell: (t) => t.title },
        { header: 'Часов всего', cell: (t) => formatNumber(t.totalHours), isNumeric: true },
        { header: 'Выполнений', cell: (t) => t.totalDone, isNumeric: true },
        { header: 'Поинтов', cell: (t) => formatNumber(t.totalPoints), isNumeric: true },
      ]}
    />
  );
}
