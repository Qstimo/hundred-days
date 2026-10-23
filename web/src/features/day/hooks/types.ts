import type { components } from '@/api-client';

/** Ответ страницы дня — тип из контракта, не свой. */
export type DayResponse = components['schemas']['DayResponse'];

/** Трекер на странице дня вместе с отметкой и недельным счётом. */
export type DayTracker = components['schemas']['DayTracker'];

/** Отметка выполнения. */
export type Entry = components['schemas']['Entry'];

/** Пункт плана. */
export type DayPlan = components['schemas']['DayPlan'];

/** Запись сна. */
export type Sleep = components['schemas']['Sleep'];

/** Намерение изменить отметку. */
export interface IEntryIntent {
  trackerId: number;
  hours: number | null;
  done: boolean;
}
