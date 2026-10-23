export interface IProps {
  /** Текст в поле. Строка, а не число: «1.» в процессе набора — не число. */
  value: string;
  /** Можно ли править. */
  isEditable: boolean;
  /** Набор нового значения. */
  onChange: (value: string) => void;
  /** Уход фокуса — момент записи. */
  onCommit: () => void;
}
