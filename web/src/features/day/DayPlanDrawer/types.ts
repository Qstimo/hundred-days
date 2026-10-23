import type { DayPlan } from '../hooks';

export interface IProps {
  /** Правимый пункт. null — панель закрыта. */
  plan: DayPlan | null;
  /** Сохранить новый текст. */
  onSave: (title: string) => Promise<void>;
  /** Удалить пункт. */
  onDelete: () => Promise<void>;
  /** Закрыть панель. */
  onClose: () => void;
}
