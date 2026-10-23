import type { StatsResponse } from '../hooks';
import type { RangePreset } from '../constants';

export interface IProps {
  /** Статистика, полученная на сервере. */
  initialStats: StatsResponse;
  /** Выбранный пресет отрезка. */
  preset: RangePreset;
  /** Границы отрезка. */
  from: string;
  to: string;
}
