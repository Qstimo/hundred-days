import { DataTable } from '@/components/DataTable';
import { formatDayMonth } from '@/features/day/utils';
import { formatDuration } from '@/features/day/SleepBlock/utils';
import type { StatsSleep } from '../../hooks';

/** Сон таблицей: времена, длительность, оценка. */
export function SleepTable({ sleep }: { sleep: StatsSleep[] }) {
  return (
    <DataTable
      caption="Сон по дням"
      rows={sleep}
      columns={[
        { header: 'Дата', cell: (s) => formatDayMonth(s.date) },
        { header: 'Лёг', cell: (s) => s.wentToBedAt ?? '—' },
        { header: 'Встал', cell: (s) => s.wokeUpAt ?? '—' },
        {
          header: 'Длительность',
          cell: (s) => (s.durationMinutes != null ? formatDuration(s.durationMinutes) : '—'),
          isNumeric: true,
        },
        { header: 'Оценка', cell: (s) => s.quality ?? '—', isNumeric: true },
      ]}
    />
  );
}
