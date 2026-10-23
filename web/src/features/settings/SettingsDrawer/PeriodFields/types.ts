/** Поля панели периода. Строками: это значения полей ввода. */
export interface IPeriodDraft {
  periodTitle: string;
  periodStart: string;
  periodDays: string;
  sleepEnabled: boolean;
}

export interface IProps {
  /** Текущие значения. */
  draft: IPeriodDraft;
  /** Сдвинется ли номер дня: показывать ли предупреждение. */
  willShiftDayNumber: boolean;
  /** Дата окончания периода или null, если посчитать нельзя. */
  end: string | null;
  /** Правка поля. */
  onChange: <K extends keyof IPeriodDraft>(key: K, value: IPeriodDraft[K]) => void;
}
