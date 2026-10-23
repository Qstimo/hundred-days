'use client';

import { Button } from '@/components/ui/button';
import { POINT_FORMS, TRACKER_FORMS, withPlural } from '@/lib/plural';
import type { IProps } from './types';

/** Реестр навыков: цель и кто её питает. */
export function SkillList({ skills, trackers, onEdit, onCreate }: IProps) {
  const feedingCount = (skillId: number) =>
    trackers.filter((t) => t.skillId === skillId).length;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Навыки</h2>
        <Button size="sm" onClick={onCreate}>
          Завести навык
        </Button>
      </div>

      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Навыков пока нет. Навык — цель в поинтах, которую питают трекеры.
        </p>
      ) : (
        <ul className="divide-y">
          {skills.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-3">
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground">
                  цель {withPlural(s.targetPoints, POINT_FORMS)} ·{' '}
                  питают {withPlural(feedingCount(s.id), TRACKER_FORMS)}
                  {s.unitLabel && ` · единица: ${s.unitLabel}`}
                </span>
              </div>

              <Button variant="ghost" size="sm" onClick={() => onEdit(s)}>
                Правка
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
