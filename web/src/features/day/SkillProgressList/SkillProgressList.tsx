import Link from 'next/link';
import type { IProps } from './types';

/**
 * Короткий прогресс навыков на странице дня.
 *
 * Серверный компонент: данные приходят в ответе дня, своего состояния у
 * блока нет, и клиентским ему быть незачем.
 *
 * Прогноз здесь не показывается — он живёт на дашборде. На странице дня
 * нужен ответ на «сколько уже забрано», а не на «успею ли».
 */
export function SkillProgressList({ skills }: IProps) {
  if (skills.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Навыки</h2>
        <Link href="/dashboard" className="text-sm underline">
          Подробнее
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {skills.map(({ skill, earnedPoints }) => {
          const percent =
            skill.targetPoints > 0
              ? Math.min(100, Math.round((earnedPoints / skill.targetPoints) * 100))
              : 0;

          return (
            <li key={skill.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium">{skill.title}</span>
                <span className="text-muted-foreground">
                  {earnedPoints} из {skill.targetPoints}
                </span>
              </div>

              <div
                role="progressbar"
                aria-label={`${skill.title}: забрано ${earnedPoints} из ${skill.targetPoints}`}
                aria-valuenow={earnedPoints}
                aria-valuemin={0}
                aria-valuemax={skill.targetPoints}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  data-testid={`skill-fill-${skill.id}`}
                  className="h-full bg-primary"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
