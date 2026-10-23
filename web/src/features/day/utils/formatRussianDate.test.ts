import { describe, expect, it } from 'vitest';
import {
  compareISODate,
  formatDayMonth,
  formatDaysLeft,
  formatRussianDate,
  shiftISODate,
} from './formatRussianDate';

describe('formatRussianDate', () => {
  it('пишет дату по-русски с днём недели', () => {
    // 23 октября 2026 — пятница.
    expect(formatRussianDate('2026-10-23')).toBe('23 октября, пятница');
  });

  it('называет сегодня сегодняшним днём', () => {
    expect(formatRussianDate('2026-10-23', '2026-10-23')).toBe('Сегодня, 23 октября');
  });

  it('называет вчера вчерашним', () => {
    expect(formatRussianDate('2026-10-22', '2026-10-23')).toBe('Вчера, 22 октября');
  });

  it('прочие дни пишет полностью', () => {
    expect(formatRussianDate('2026-10-21', '2026-10-23')).toBe('21 октября, среда');
  });

  // Главная ловушка: new Date('2026-01-01') даёт полночь UTC, и в зоне +03
  // такая дата съезжает на 31 декабря. Разбор идёт по числам, без
  // конструктора от строки.
  it('не съезжает на день назад в положительной зоне', () => {
    expect(formatRussianDate('2026-01-01')).toBe('1 января, четверг');
    expect(formatRussianDate('2026-03-01')).toBe('1 марта, воскресенье');
  });

  it('знает все месяцы в родительном падеже', () => {
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    months.forEach((name, i) => {
      const iso = `2026-${String(i + 1).padStart(2, '0')}-15`;
      expect(formatRussianDate(iso)).toContain(name);
    });
  });
});

describe('formatDaysLeft', () => {
  it('согласует слово «день» с числом', () => {
    expect(formatDaysLeft(1)).toBe('остался 1 день');
    expect(formatDaysLeft(2)).toBe('осталось 2 дня');
    expect(formatDaysLeft(5)).toBe('осталось 5 дней');
    expect(formatDaysLeft(11)).toBe('осталось 11 дней');
    expect(formatDaysLeft(21)).toBe('остался 21 день');
    expect(formatDaysLeft(78)).toBe('осталось 78 дней');
  });

  it('кончившийся период называет завершённым', () => {
    expect(formatDaysLeft(0)).toBe('период завершён');
  });
});

describe('shiftISODate', () => {
  it('сдвигает на день вперёд и назад', () => {
    expect(shiftISODate('2026-10-23', 1)).toBe('2026-10-24');
    expect(shiftISODate('2026-10-23', -1)).toBe('2026-10-22');
  });

  it('переходит через границу месяца', () => {
    expect(shiftISODate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftISODate('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('переходит через границу года', () => {
    expect(shiftISODate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftISODate('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('знает про високосный год', () => {
    expect(shiftISODate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftISODate('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('compareISODate', () => {
  it('сравнивает даты как строки, без разбора', () => {
    expect(compareISODate('2026-10-23', '2026-10-24')).toBeLessThan(0);
    expect(compareISODate('2026-10-24', '2026-10-23')).toBeGreaterThan(0);
    expect(compareISODate('2026-10-23', '2026-10-23')).toBe(0);
  });

  it('верно сравнивает через границу месяца и года', () => {
    expect(compareISODate('2026-09-30', '2026-10-01')).toBeLessThan(0);
    expect(compareISODate('2026-12-31', '2027-01-01')).toBeLessThan(0);
  });
});

describe('formatDayMonth', () => {
  it('пишет дату без дня недели', () => {
    expect(formatDayMonth('2027-01-08')).toBe('8 января');
    expect(formatDayMonth('2026-10-23')).toBe('23 октября');
  });

  it('не съезжает на день назад в положительной зоне', () => {
    expect(formatDayMonth('2026-01-01')).toBe('1 января');
  });
});
