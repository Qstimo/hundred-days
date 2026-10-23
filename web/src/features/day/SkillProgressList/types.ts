import type { components } from '@/api-client';

export interface IProps {
  /** Навыки с накопленными поинтами. */
  skills: components['schemas']['DaySkill'][];
}
