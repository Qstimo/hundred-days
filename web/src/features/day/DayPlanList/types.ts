import type { DayPlan } from '../hooks';

export interface IProps {
  /** Пункты открытого дня. */
  plans: DayPlan[];
  /** Открытая дата, «ГГГГ-ММ-ДД». */
  date: string;
  /** Есть ли что переносить со вчера: кнопка показывается только тогда. */
  carryOverAvailable: boolean;
}
