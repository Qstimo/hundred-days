import type { Settings } from '../hooks';

export interface IProps {
  /** Текущие настройки. undefined — панель закрыта. */
  settings: Settings | undefined;
  /** Сохранить. */
  onSave: (next: Settings) => Promise<void>;
  /** Закрыть. */
  onClose: () => void;
}
