import type { DayPlan } from '../hooks';

export interface IProps {
  /** Пункт плана. */
  plan: DayPlan;
  /** Закрыть или открыть пункт. */
  onToggle: (done: boolean) => void;
  /** Открыть панель правки. */
  onEdit: () => void;
}
