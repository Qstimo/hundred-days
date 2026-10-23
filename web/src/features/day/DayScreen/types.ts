import type { DayResponse } from '../hooks';

export interface IProps {
  /** Данные дня, полученные на сервере: первая отрисовка приходит заполненной. */
  initialDay: DayResponse;
  /** Запрошенная дата. Пусто — сегодня по мнению сервера. */
  date?: string;
}
