import type { Skill } from '../../hooks';
import type { ITrackerDraft } from '../utils';

export interface IProps {
  /** Текущие значения полей. */
  draft: ITrackerDraft;
  /** Навыки, которые можно привязать. */
  skills: Skill[];
  /** Правка одного поля. */
  onChange: <K extends keyof ITrackerDraft>(key: K, value: ITrackerDraft[K]) => void;
}
