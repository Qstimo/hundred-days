import type { StatsResponse } from '../hooks';

export interface IProps {
  /** Статистика за отрезок. */
  stats: StatsResponse;
  /** Длина отрезка в днях — для подписи процента. */
  rangeDays: number;
}
