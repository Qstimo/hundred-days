import { PLAN_FORMS, WEEK_FORMS, withPlural } from '@/lib/plural';
import { StatTile } from './StatTile';
import type { IProps } from './types';

/**
 * Ряд плиток: серии, выполнение, планы.
 *
 * Это заголовочные числа, и каждое — плитка, а не график. Серия в неделях,
 * потому что цель недельная.
 */
export function StatTiles({ stats, rangeDays }: IProps) {
  const best = stats.trackers.reduce(
    (acc, t) => (t.currentStreak > acc.currentStreak ? t : acc),
    stats.trackers[0],
  );

  const rate =
    stats.trackers.length > 0
      ? stats.trackers.reduce((sum, t) => sum + t.completionRate, 0) /
        stats.trackers.length
      : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label="Самая длинная текущая серия"
        value={best ? withPlural(best.currentStreak, WEEK_FORMS) : '—'}
        hint={best ? `${best.title}, лучшая — ${best.bestStreak}` : 'трекеров нет'}
      />

      <StatTile
        label="Выполнение за отрезок"
        value={`${Math.round(rate * 100)}%`}
        hint={`в среднем по трекерам, ${rangeDays} дн.`}
      />

      <StatTile
        label="Закрытые планы"
        value={
          stats.plans.total > 0 ? `${Math.round(stats.plans.rate * 100)}%` : '—'
        }
        hint={
          stats.plans.total > 0
            ? `${stats.plans.done} из ${withPlural(stats.plans.total, PLAN_FORMS)}`
            : 'планов за отрезок не было'
        }
      />
    </div>
  );
}
