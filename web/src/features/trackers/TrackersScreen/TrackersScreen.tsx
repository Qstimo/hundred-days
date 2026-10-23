'use client';

import Link from 'next/link';
import { SkillDrawer } from '../SkillDrawer';
import { SkillList } from '../SkillList';
import { TrackerDrawer } from '../TrackerDrawer';
import { TrackerTable } from '../TrackerTable';
import { useRegistryEditing } from './hooks';

/**
 * Экран реестров: трекеры и навыки.
 *
 * Оба списка на одном экране нарочно: трекер без навыка непонятен, навык без
 * трекеров бесполезен, и заводят их почти всегда вместе.
 */
export function TrackersScreen() {
  const registry = useRegistryEditing();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-4 pb-24 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Трекеры и навыки</h1>
        <Link href="/" className="text-sm underline">
          К сегодняшнему дню
        </Link>
      </div>

      <TrackerTable
        trackers={registry.trackers}
        skills={registry.skills}
        onEdit={registry.openTracker}
        onCreate={() => registry.openTracker(null)}
      />

      <SkillList
        skills={registry.skills}
        trackers={registry.trackers}
        onEdit={registry.openSkill}
        onCreate={() => registry.openSkill(null)}
      />

      <TrackerDrawer
        tracker={registry.editingTracker}
        skills={registry.skills}
        onSave={registry.saveTracker}
        onDelete={registry.editingTracker ? registry.deleteTracker : undefined}
        onClose={registry.closeTracker}
      />

      <SkillDrawer
        skill={registry.editingSkill}
        feedingTrackers={registry.feedingTrackers}
        onSave={registry.saveSkill}
        onDelete={registry.editingSkill ? registry.deleteSkill : undefined}
        onClose={registry.closeSkill}
      />
    </main>
  );
}
