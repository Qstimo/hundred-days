'use client';

import { Button } from '@/components/ui/button';
import { ENTRY_FORMS, POINT_FORMS, TIME_FORMS, withPlural } from '@/lib/plural';
import type { IProps } from './types';

/** Реестр трекеров: что отмечается, по какой цене и как часто. */
export function TrackerTable({ trackers, skills, onEdit, onCreate }: IProps) {
  const skillTitle = (id: number | null | undefined) =>
    id == null ? '—' : (skills.find((s) => s.id === id)?.title ?? '—');

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Трекеры</h2>
        <Button size="sm" onClick={onCreate}>
          Завести трекер
        </Button>
      </div>

      {trackers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Трекеров пока нет. Это то, что отмечается каждый день.
        </p>
      ) : (
        <ul className="divide-y">
          {trackers.map((t) => (
            <li key={t.id} className="flex items-center gap-4 py-3">
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {withPlural(t.weeklyTarget, TIME_FORMS)} в неделю ·{' '}
                  {withPlural(t.pointsValue, POINT_FORMS)}{' '}
                  {t.pointsRule === 'per_hour' ? 'за час' : 'за выполнение'} ·{' '}
                  навык: {skillTitle(t.skillId)} ·{' '}
                  {withPlural(t.entryCount, ENTRY_FORMS)}
                </span>
              </div>

              <Button variant="ghost" size="sm" onClick={() => onEdit(t)}>
                Правка
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
