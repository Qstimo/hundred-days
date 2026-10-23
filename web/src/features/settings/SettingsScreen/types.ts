import type { SettingsResponse } from '../hooks';

export interface IProps {
  /** Настройки с периодом, полученные на сервере. */
  initialSettings: SettingsResponse;
}
