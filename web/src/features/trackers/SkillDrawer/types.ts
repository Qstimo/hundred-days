import type { Skill, SkillInput, Tracker } from '../hooks';

export interface IProps {
  /** Правимый навык. null — создание. undefined — панель закрыта. */
  skill: Skill | null | undefined;
  /** Трекеры, питающие этот навык. */
  feedingTrackers: Tracker[];
  /** Сохранить. */
  onSave: (input: SkillInput) => Promise<void>;
  /** Удалить. */
  onDelete?: () => Promise<void>;
  /** Закрыть. */
  onClose: () => void;
}
