export interface IProps {
  /** Показывать ли вопрос. */
  isOpen: boolean;
  /** Что удаляется, в именительном падеже: «трекер «Чтение»». */
  what: string;
  /** Что при этом будет унесено. Пусто — ничего, кроме самой записи. */
  consequence?: string;
  /** Подтверждённое удаление. */
  onConfirm: () => void;
  /** Отказ. */
  onCancel: () => void;
}
