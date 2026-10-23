import { describe, expect, it } from 'vitest';
import { applyEntryLocally } from './applyEntryLocally';
import type { DayResponse } from './types';

function dayWith(entry: DayResponse['trackers'][number]['entry']): DayResponse {
  return {
    date: '2026-10-23',
    period: {
      title: '100 дней до',
      start: '2026-10-01',
      days: 100,
      today: '2026-10-23',
      dayNumber: 23,
      daysLeft: 78,
    },
    sleepEnabled: true,
    trackers: [
      {
        tracker: {
          id: 1,
          title: 'Занятие',
          mode: 'check',
          pointsRule: 'per_check',
          pointsValue: 1,
          weeklyTarget: 3,
          sortOrder: 0,
          archived: false,
          entryCount: 0,
        },
        entry,
        weekDone: 1,
        weekTarget: 3,
      },
    ],
    plans: [],
    carryOverAvailable: false,
    skills: [],
  };
}

describe('applyEntryLocally', () => {
  it('ставит отметку, которой не было', () => {
    const next = applyEntryLocally(dayWith(null), {
      trackerId: 1,
      hours: null,
      done: true,
    });

    expect(next?.trackers[0].entry).not.toBeNull();
    expect(next?.trackers[0].weekDone, 'недельный счёт растёт сразу').toBe(2);
  });

  it('снимает отметку, которая была', () => {
    const current = dayWith({ date: '2026-10-23', pointsAwarded: 1 });

    const next = applyEntryLocally(current, {
      trackerId: 1,
      hours: null,
      done: false,
    });

    expect(next?.trackers[0].entry).toBeNull();
    expect(next?.trackers[0].weekDone).toBe(0);
  });

  it('повторная отметка недельный счёт не удваивает', () => {
    const current = dayWith({ date: '2026-10-23', pointsAwarded: 1 });

    const next = applyEntryLocally(current, {
      trackerId: 1,
      hours: 2,
      done: true,
    });

    expect(next?.trackers[0].weekDone, 'отметка уже была').toBe(1);
    expect(next?.trackers[0].entry?.hours).toBe(2);
  });

  it('повторное снятие счёт ниже нуля не уводит', () => {
    const next = applyEntryLocally(dayWith(null), {
      trackerId: 1,
      hours: null,
      done: false,
    });

    expect(next?.trackers[0].weekDone).toBe(1);
  });

  it('не трогает чужие трекеры', () => {
    const current = dayWith(null);

    const next = applyEntryLocally(current, {
      trackerId: 999,
      hours: null,
      done: true,
    });

    expect(next?.trackers[0].entry).toBeNull();
  });

  it('пустой снимок оставляет пустым: нечего обновлять', () => {
    expect(applyEntryLocally(undefined, { trackerId: 1, hours: null, done: true }))
      .toBeUndefined();
  });

  it('не меняет исходный снимок: откат должен иметь куда вернуться', () => {
    const current = dayWith(null);

    applyEntryLocally(current, { trackerId: 1, hours: null, done: true });

    expect(current.trackers[0].entry).toBeNull();
    expect(current.trackers[0].weekDone).toBe(1);
  });
});
