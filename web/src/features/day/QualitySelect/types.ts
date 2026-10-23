export interface IProps {
  /** Оценка 1…5. null — не задана. */
  value: number | null;
  /** Выбор новой оценки. */
  onChange: (value: number | null) => void;
}
