import type { Skill, Tracker } from '../hooks';

export interface IProps {
  /** Навыки реестра. */
  skills: Skill[];
  /** Трекеры — чтобы показать, сколько питают каждый навык. */
  trackers: Tracker[];
  /** Открыть панель правки. */
  onEdit: (skill: Skill) => void;
  /** Открыть панель создания. */
  onCreate: () => void;
}
