export interface ISelectOption {
  value: string | number;
  label: string;
}

export interface IProps {
  /** Идентификатор для связи подписи и поля. */
  id: string;
  /** Подпись. */
  label: string;
  /** Текущее значение. */
  value: string;
  /** Варианты. */
  options: ReadonlyArray<ISelectOption>;
  /** Выбор нового значения. */
  onChange: (value: string) => void;
}
