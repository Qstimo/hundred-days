import type { DayResponse, IEntryIntent } from './types';

/**
 * Применяет отметку к снимку дня, не обращаясь к серверу.
 *
 * Нужна для оптимистичного обновления: галочка — одно нажатие, и ждать
 * ответа, чтобы она закрасилась, значит сделать экран вязким.
 *
 * Снимок не меняется на месте, а копируется: кэш отдаёт тот же объект, что
 * лежит в нём, и правка по месту лишила бы откат точки возврата.
 *
 * Поинты здесь не считаются. Их считает сервер по цене трекера и фиксирует
 * в записи; местная догадка разошлась бы с правдой на трекере с часами, а
 * после ответа всё равно перечитывается.
 */
export function applyEntryLocally(
  current: DayResponse | undefined,
  intent: IEntryIntent,
): DayResponse | undefined {
  if (!current) return current;

  return {
    ...current,
    trackers: current.trackers.map((t) => {
      if (t.tracker.id !== intent.trackerId) return t;

      const wasDone = t.entry != null;
      if (wasDone === intent.done) {
        // Состояние то же — меняются только часы.
        return intent.done
          ? { ...t, entry: { ...t.entry!, hours: intent.hours } }
          : t;
      }

      return {
        ...t,
        entry: intent.done
          ? { date: current.date, hours: intent.hours, pointsAwarded: 0 }
          : null,
        weekDone: intent.done ? t.weekDone + 1 : Math.max(0, t.weekDone - 1),
      };
    }),
  };
}
