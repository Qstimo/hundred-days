export interface IProps {
  /** Показывать ли вопрос. */
  isOpen: boolean;
  /** Закрыть, потеряв правку. */
  onDiscard: () => void;
  /** Вернуться к правке. */
  onCancel: () => void;
}
