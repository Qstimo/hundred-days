import { describe, expect, it } from 'vitest';
import {
  EMPTY_DRAFT,
  draftFromTracker,
  isDraftValid,
  trackerInputFromDraft,
} from './draftFromTracker';
import type { Tracker } from '../../hooks';

const tracker: Tracker = {
  id: 1,
  title: 'Чтение',
  mode: 'check_hours',
  pointsRule: 'per_hour',
  pointsValue: 1.5,
  skillId: 7,
  weeklyTarget: 4,
  sortOrder: 0,
  archived: false,
  entryCount: 12,
};

describe('draftFromTracker', () => {
  it('переводит трекер в поля панели', () => {
    expect(draftFromTracker(tracker)).toEqual({
      title: 'Чтение',
      mode: 'check_hours',
      pointsRule: 'per_hour',
      pointsValue: '1.5',
      skillId: '7',
      weeklyTarget: '4',
    });
  });

  it('новый трекер получает значения по умолчанию', () => {
    expect(draftFromTracker(null)).toEqual(EMPTY_DRAFT);
    expect(draftFromTracker(undefined)).toEqual(EMPTY_DRAFT);
  });

  it('отсутствие навыка даёт пустую строку, а не «null»', () => {
    expect(draftFromTracker({ ...tracker, skillId: null }).skillId).toBe('');
  });
});

describe('trackerInputFromDraft', () => {
  it('приводит поля к виду контракта', () => {
    expect(trackerInputFromDraft(draftFromTracker(tracker))).toEqual({
      title: 'Чтение',
      mode: 'check_hours',
      pointsRule: 'per_hour',
      pointsValue: 1.5,
      skillId: 7,
      weeklyTarget: 4,
    });
  });

  // Форма не должна давать собрать сочетание, которое сервер отвергнет.
  it('сбрасывает правило «за час» при режиме без часов', () => {
    const draft = { ...EMPTY_DRAFT, mode: 'check' as const, pointsRule: 'per_hour' as const };

    expect(trackerInputFromDraft(draft).pointsRule).toBe('per_check');
  });

  it('оставляет правило «за час» при режиме с часами', () => {
    const draft = {
      ...EMPTY_DRAFT,
      mode: 'check_hours' as const,
      pointsRule: 'per_hour' as const,
    };

    expect(trackerInputFromDraft(draft).pointsRule).toBe('per_hour');
  });

  it('принимает запятую в цене', () => {
    expect(trackerInputFromDraft({ ...EMPTY_DRAFT, pointsValue: '2,5' }).pointsValue)
      .toBe(2.5);
  });

  it('пустой навык уходит как отсутствие связи', () => {
    expect(trackerInputFromDraft({ ...EMPTY_DRAFT, skillId: '' }).skillId).toBeNull();
  });

  it('обрезает пробелы в названии', () => {
    expect(trackerInputFromDraft({ ...EMPTY_DRAFT, title: '  Занятие  ' }).title)
      .toBe('Занятие');
  });
});

describe('isDraftValid', () => {
  it('годный черновик проходит', () => {
    expect(isDraftValid({ ...EMPTY_DRAFT, title: 'Занятие' })).toBe(true);
  });

  it('пустое название не проходит', () => {
    expect(isDraftValid({ ...EMPTY_DRAFT, title: '   ' })).toBe(false);
  });

  it('отрицательная цена не проходит', () => {
    expect(isDraftValid({ ...EMPTY_DRAFT, title: 'a', pointsValue: '-1' })).toBe(false);
  });

  it('нулевая цена проходит: трекер без поинтов — обычная привычка', () => {
    expect(isDraftValid({ ...EMPTY_DRAFT, title: 'a', pointsValue: '0' })).toBe(true);
  });

  it('недельная цель вне 1…7 не проходит', () => {
    expect(isDraftValid({ ...EMPTY_DRAFT, title: 'a', weeklyTarget: '0' })).toBe(false);
    expect(isDraftValid({ ...EMPTY_DRAFT, title: 'a', weeklyTarget: '8' })).toBe(false);
    expect(isDraftValid({ ...EMPTY_DRAFT, title: 'a', weeklyTarget: '3.5' })).toBe(false);
  });
});
