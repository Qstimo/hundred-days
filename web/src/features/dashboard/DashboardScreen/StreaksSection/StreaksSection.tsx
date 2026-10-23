import { StreaksTable } from '../tables';
import type { StatsTracker } from '../../hooks';

export interface IProps {
  trackers: StatsTracker[];
  isRefreshing: boolean;
}

/**
 * Серии и выполнение — таблицей, а не графиком.
 *
 * Это не величина и не ряд, а несколько чисел на трекер. Переключателя
 * «график / таблица» здесь нет: менять таблицу на таблицу незачем.
 */
export function StreaksSection({ trackers, isRefreshing }: IProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Серии и выполнение</h2>
        <p className="text-xs text-muted-foreground">
          серия считается по неделям: цель недельная
        </p>
      </div>

      <div className={isRefreshing ? 'opacity-60 transition-opacity' : undefined}>
        <StreaksTable trackers={trackers} />
      </div>
    </section>
  );
}
