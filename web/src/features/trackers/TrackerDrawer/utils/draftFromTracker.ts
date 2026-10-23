import type { PointsRule, Tracker, TrackerInput, TrackerMode } from '../../hooks';

/** Поля панели трекера. Всё строками: это значения полей ввода. */
export interface ITrackerDraft {
  title: string;
  mode: TrackerMode;
  pointsRule: PointsRule;
  pointsValue: string;
  skillId: string;
  weeklyTarget: string;
}

/** Значения по умолчанию для нового трекера. */
export const EMPTY_DRAFT: ITrackerDraft = {
  title: '',
  mode: 'check',
  pointsRule: 'per_check',
  pointsValue: '1',
  skillId: '',
  weeklyTarget: '3',
};

/** Переводит трекер в поля панели. */
export function draftFromTracker(tracker: Tracker | null | undefined): ITrackerDraft {
  if (!tracker) return EMPTY_DRAFT;

  return {
    title: tracker.title,
    mode: tracker.mode,
    pointsRule: tracker.pointsRule,
    pointsValue: String(tracker.pointsValue),
    skillId: tracker.skillId != null ? String(tracker.skillId) : '',
    weeklyTarget: String(tracker.weeklyTarget),
  };
}

/**
 * Приводит поля панели к виду контракта.
 *
 * Правило «за час» у трекера без часов отбрасывается здесь, а не только
 * отвергается сервером: форма не должна давать собрать заведомо негодное
 * сочетание. Проверку на сервере это не отменяет — она последняя линия.
 */
export function trackerInputFromDraft(draft: ITrackerDraft): TrackerInput {
  const pointsRule =
    draft.mode === 'check' && draft.pointsRule === 'per_hour'
      ? 'per_check'
      : draft.pointsRule;

  return {
    title: draft.title.trim(),
    mode: draft.mode,
    pointsRule,
    pointsValue: Number(draft.pointsValue.replace(',', '.')) || 0,
    skillId: draft.skillId === '' ? null : Number(draft.skillId),
    weeklyTarget: Number(draft.weeklyTarget) || 1,
  };
}

/** Можно ли сохранять: название непустое, цена и цель в пределах. */
export function isDraftValid(draft: ITrackerDraft): boolean {
  const value = Number(draft.pointsValue.replace(',', '.'));
  const target = Number(draft.weeklyTarget);

  return (
    draft.title.trim() !== '' &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isInteger(target) &&
    target >= 1 &&
    target <= 7
  );
}
