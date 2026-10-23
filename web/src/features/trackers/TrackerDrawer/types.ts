import type { Skill, Tracker, TrackerInput } from '../hooks';

export interface IProps {
  /** Правимый трекер. null — создание нового. undefined — панель закрыта. */
  tracker: Tracker | null | undefined;
  /** Навыки, которые можно привязать. */
  skills: Skill[];
  /** Сохранить. */
  onSave: (input: TrackerInput) => Promise<void>;
  /** Удалить. Только у существующего. */
  onDelete?: () => Promise<void>;
  /** Закрыть панель. */
  onClose: () => void;
}
