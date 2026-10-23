import type { Sleep } from '../hooks';

export interface IProps {
  /** Запись сна за день. null — не заполнено. */
  sleep: Sleep | null;
  /** Открытая дата, «ГГГГ-ММ-ДД». */
  date: string;
}
