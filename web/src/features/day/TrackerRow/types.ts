import type { DayTracker } from '../hooks';

export interface IProps {
  /** Трекер с отметкой за открытый день и недельным счётом. */
  item: DayTracker;
  /** Можно ли менять отметку: у будущего дня нельзя. */
  isEditable: boolean;
  /** Поставить или снять отметку. */
  onToggle: (hours: number | null, done: boolean) => void;
  /** Изменить часы у уже отмеченного. */
  onHoursChange: (hours: number | null) => void;
}
