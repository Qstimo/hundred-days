import { POINT_FORMS, formatNumber, withPlural } from '@/lib/plural';
import type { IProps } from './types';

/**
 * Прогресс навыков — метры, а не диаграмма.
 *
 * Отношение к пределу рисуется дорожкой того же тона: столбик здесь был бы
 * диаграммой из одного столбика, а круговая — двумя дольками.
 *
 * Метка прогноза стоит на той же дорожке: она отвечает на «успею ли», и
 * выносить её во второй график значило бы разорвать один вопрос на два.
 * Прогноз не красится цветом состояния — он догадка о будущем, а не оценка.
 */
export function SkillMeters({ skills }: IProps) {
  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">Навыков пока нет</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {skills.map((s) => {
        const earnedPercent = percentOf(s.earnedPoints, s.targetPoints);
        const forecastPercent = percentOf(s.forecast, s.targetPoints);

        return (
          <li key={s.skillId} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium">{s.title}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(s.earnedPoints)} из {formatNumber(s.targetPoints)}
              </span>
            </div>

            <div
              role="progressbar"
              aria-label={`${s.title}: забрано ${withPlural(s.earnedPoints, POINT_FORMS)} из ${formatNumber(s.targetPoints)}`}
              aria-valuenow={s.earnedPoints}
              aria-valuemin={0}
              aria-valuemax={s.targetPoints}
              className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                data-testid={`meter-fill-${s.skillId}`}
                className="h-full rounded-r-[4px] bg-chart-1"
                style={{ width: `${earnedPercent}%` }}
              />

              {forecastPercent > earnedPercent && forecastPercent < 100 && (
                <span
                  data-testid={`meter-forecast-${s.skillId}`}
                  aria-hidden="true"
                  className="absolute top-0 h-full w-0.5 bg-chart-axis"
                  style={{ left: `${forecastPercent}%` }}
                />
              )}
            </div>

            <span className="text-xs text-muted-foreground">
              {s.pacePerDay > 0
                ? `при темпе ${formatNumber(s.pacePerDay)} в день — ${formatNumber(s.forecast)} к концу периода`
                : 'темпа за последние две недели нет'}
              {s.pacePerDay > 0 && (s.willReach ? ', цель будет взята' : ', цель не успевает')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Доля в процентах, обрезанная сотней: перевыполнение дорожку не рвёт. */
function percentOf(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}
