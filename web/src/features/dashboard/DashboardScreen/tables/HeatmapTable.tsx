import { DataTable } from '@/components/DataTable';
import { formatDayMonth } from '@/features/day/utils';
import { formatNumber } from '@/lib/plural';
import type { StatsTracker } from '../../hooks';

/** Теплокарта таблицей: день за днём. */
export function HeatmapTable({ tracker }: { tracker: StatsTracker }) {
  return (
    <DataTable
      caption={`Дни трекера «${tracker.title}»`}
      rows={tracker.days}
      columns={[
        { header: 'Дата', cell: (d) => formatDayMonth(d.date) },
        { header: 'Сделано', cell: (d) => (d.done ? 'да' : 'нет') },
        {
          header: 'Часы',
          cell: (d) => (d.hours != null ? formatNumber(d.hours) : '—'),
          isNumeric: true,
        },
        { header: 'Поинты', cell: (d) => formatNumber(d.points), isNumeric: true },
      ]}
    />
  );
}
