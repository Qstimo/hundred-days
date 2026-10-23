import { DataTable } from '@/components/DataTable';
import { formatDayMonth } from '@/features/day/utils';
import { formatNumber } from '@/lib/plural';
import type { StatsSkill } from '../../hooks';

/** Навыки таблицей: забрано, цель, прогноз. */
export function SkillsTable({ skills }: { skills: StatsSkill[] }) {
  return (
    <DataTable
      caption="Прогресс навыков"
      rows={skills}
      columns={[
        { header: 'Навык', cell: (s) => s.title },
        { header: 'Забрано', cell: (s) => formatNumber(s.earnedPoints), isNumeric: true },
        { header: 'Цель', cell: (s) => formatNumber(s.targetPoints), isNumeric: true },
        { header: 'Темп в день', cell: (s) => formatNumber(s.pacePerDay), isNumeric: true },
        { header: 'Прогноз', cell: (s) => formatNumber(s.forecast), isNumeric: true },
        { header: 'Успеет', cell: (s) => (s.willReach ? 'да' : 'нет') },
      ]}
    />
  );
}
