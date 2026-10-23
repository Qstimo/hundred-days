import type { Skill, Tracker } from '../hooks';

export interface IProps {
  /** Трекеры реестра. */
  trackers: Tracker[];
  /** Навыки — чтобы показать название привязанного. */
  skills: Skill[];
  /** Открыть панель правки. */
  onEdit: (tracker: Tracker) => void;
  /** Открыть панель создания. */
  onCreate: () => void;
}
