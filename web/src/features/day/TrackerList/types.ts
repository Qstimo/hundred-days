import type { DayTracker } from '../hooks';

export interface IProps {
  /** Трекеры открытого дня. */
  items: DayTracker[];
  /** Открытая дата, «ГГГГ-ММ-ДД». */
  date: string;
  /** Можно ли менять отметки: у будущего дня нельзя. */
  isEditable: boolean;
}
