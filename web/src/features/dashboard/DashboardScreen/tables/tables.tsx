import { DataTable } from '@/components/DataTable';
import { formatDayMonth } from '@/features/day/utils';
import { formatDuration } from '@/features/day/SleepBlock/utils';
import { formatNumber } from '@/lib/plural';
import type { StatsSkill, StatsSleep, StatsTracker } from '../../hooks';

/**
 * Табличные двойники графиков.
 *
 * Собраны в одном месте: это не экраны и не части графиков, а один и тот же
 * приём — показать то же самое без цвета. Каждый график обязан иметь такую
 * таблицу, иначе значение оказывается заперто в цвете и подсказке.
 */

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
