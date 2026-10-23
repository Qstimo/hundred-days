/** Пресеты отрезка. Перечислением: значение живёт в адресе и в разметке. */
export enum RangePreset {
  Days30 = '30d',
  Days90 = '90d',
  Period = 'period',
  All = 'all',
}

/** Подписи переключателя. Дата первой: за ней тянутся чаще всего. */
export const RANGE_LABELS: Record<RangePreset, string> = {
  [RangePreset.Days30]: '30 дней',
  [RangePreset.Days90]: '90 дней',
  [RangePreset.Period]: 'Весь период',
  [RangePreset.All]: 'Всё время',
};

/** Порядок кнопок. */
export const RANGE_ORDER: readonly RangePreset[] = [
  RangePreset.Days30,
  RangePreset.Days90,
  RangePreset.Period,
  RangePreset.All,
];

/**
 * Предел длины отрезка — тот же, что на сервере. Повторён здесь, чтобы
 * «всё время» не уходило в запрос, который будет отвергнут.
 */
export const MAX_RANGE_DAYS = 400;
