import type { RangePreset } from '../constants';

export interface IProps {
  /** Выбранный пресет. */
  value: RangePreset;
  /** Границы выбранного отрезка — показываются подписью. */
  from: string;
  to: string;
}
