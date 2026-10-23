/** Поля панели навыка. Строками: это значения полей ввода. */
export interface ISkillDraft {
  title: string;
  targetPoints: string;
  unitLabel: string;
}

export interface IProps {
  /** Текущие значения. */
  draft: ISkillDraft;
  /** Годен ли черновик: от этого зависит подсказка у цели. */
  isValid: boolean;
  /** Правка поля. */
  onChange: <K extends keyof ISkillDraft>(key: K, value: ISkillDraft[K]) => void;
}
