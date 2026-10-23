import { useState } from 'react';
import {
  useMutationSkill,
  useMutationTracker,
  useQuerySkills,
  useQueryTrackers,
} from '../../hooks';
import type { Skill, SkillInput, Tracker, TrackerInput } from '../../hooks';

/**
 * Состояние реестров и правок: списки, открытые панели, сохранение.
 *
 * Вынесено из экрана, чтобы тот остался композицией. Три состояния панели
 * выражены одной переменной: undefined — закрыта, null — создание, объект —
 * правка. Двумя флагами можно было бы выразить «закрыта и одновременно
 * правится», чего не бывает.
 */
export function useRegistryEditing() {
  const trackersQuery = useQueryTrackers();
  const skillsQuery = useQuerySkills();
  const trackerMutation = useMutationTracker();
  const skillMutation = useMutationSkill();

  const [editingTracker, setEditingTracker] = useState<Tracker | null | undefined>();
  const [editingSkill, setEditingSkill] = useState<Skill | null | undefined>();

  const trackers = trackersQuery.data ?? [];
  const skills = skillsQuery.data ?? [];

  async function saveTracker(input: TrackerInput) {
    if (editingTracker) {
      await trackerMutation.update.mutateAsync({ id: editingTracker.id, body: input });
    } else {
      await trackerMutation.create.mutateAsync(input);
    }
    setEditingTracker(undefined);
  }

  async function deleteTracker() {
    if (!editingTracker) return;
    await trackerMutation.remove.mutateAsync(editingTracker.id);
    setEditingTracker(undefined);
  }

  async function saveSkill(input: SkillInput) {
    if (editingSkill) {
      await skillMutation.update.mutateAsync({ id: editingSkill.id, body: input });
    } else {
      await skillMutation.create.mutateAsync(input);
    }
    setEditingSkill(undefined);
  }

  async function deleteSkill() {
    if (!editingSkill) return;
    await skillMutation.remove.mutateAsync(editingSkill.id);
    setEditingSkill(undefined);
  }

  /** Трекеры, питающие правимый навык. */
  const feedingTrackers = editingSkill
    ? trackers.filter((t) => t.skillId === editingSkill.id)
    : [];

  return {
    trackers,
    skills,
    editingTracker,
    editingSkill,
    feedingTrackers,
    openTracker: setEditingTracker,
    openSkill: setEditingSkill,
    closeTracker: () => setEditingTracker(undefined),
    closeSkill: () => setEditingSkill(undefined),
    saveTracker,
    deleteTracker,
    saveSkill,
    deleteSkill,
  };
}
