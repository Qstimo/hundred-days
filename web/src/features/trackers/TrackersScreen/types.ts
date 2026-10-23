import type { Skill, Tracker } from '../hooks';

export interface IProps {
  /** Трекеры, полученные на сервере. */
  initialTrackers: Tracker[];
  /** Навыки, полученные на сервере. */
  initialSkills: Skill[];
}
