'use client';

import Link from 'next/link';
import { TrackerRow } from '../TrackerRow';
import { useMutationEntry } from '../hooks';
import type { IProps } from './types';

/**
 * Блок трекеров открытого дня.
 *
 * Мутация живёт здесь, а не в строке: она одна на весь список, и заводить её
 * в каждой строке значило бы держать столько же независимых откатов.
 */
export function TrackerList({ items, date, isEditable }: IProps) {
  const entry = useMutationEntry(date);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Трекеры</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Пока нет трекеров.{' '}
          <Link href="/trackers" className="underline">
            Завести первый
          </Link>
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <TrackerRow
              key={item.tracker.id}
              item={item}
              isEditable={isEditable}
              onToggle={(hours, done) =>
                entry.mutate({ trackerId: item.tracker.id, hours, done })
              }
              onHoursChange={(hours) =>
                entry.mutate({ trackerId: item.tracker.id, hours, done: true })
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
