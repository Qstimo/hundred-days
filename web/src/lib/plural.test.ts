import { describe, expect, it } from 'vitest';
import {
  plural,
  formatNumber,
  withPlural,
  DAY_FORMS,
  WEEK_FORMS,
  POINT_FORMS,
} from './plural';

describe('plural', () => {
  // Правило русского языка: 1, 21, 31 — одна форма; 2–4, 22–24 — вторая;
  // остальное, включая 11–14, — третья. Числа 11–14 исключение, и именно
  // на них ломаются наивные реализации «по последней цифре».
  it('склоняет «день»', () => {
    expect(plural(1, DAY_FORMS)).toBe('день');
    expect(plural(2, DAY_FORMS)).toBe('дня');
    expect(plural(4, DAY_FORMS)).toBe('дня');
    expect(plural(5, DAY_FORMS)).toBe('дней');
    expect(plural(11, DAY_FORMS)).toBe('дней');
    expect(plural(12, DAY_FORMS)).toBe('дней');
    expect(plural(14, DAY_FORMS)).toBe('дней');
    expect(plural(21, DAY_FORMS)).toBe('день');
    expect(plural(22, DAY_FORMS)).toBe('дня');
    expect(plural(25, DAY_FORMS)).toBe('дней');
    expect(plural(100, DAY_FORMS)).toBe('дней');
    expect(plural(101, DAY_FORMS)).toBe('день');
    expect(plural(111, DAY_FORMS)).toBe('дней');
  });

  it('склоняет «неделя»', () => {
    expect(plural(1, WEEK_FORMS)).toBe('неделя');
    expect(plural(2, WEEK_FORMS)).toBe('недели');
    expect(plural(5, WEEK_FORMS)).toBe('недель');
    expect(plural(11, WEEK_FORMS)).toBe('недель');
    expect(plural(21, WEEK_FORMS)).toBe('неделя');
  });

  it('склоняет «поинт»', () => {
    expect(plural(1, POINT_FORMS)).toBe('поинт');
    expect(plural(3, POINT_FORMS)).toBe('поинта');
    expect(plural(8, POINT_FORMS)).toBe('поинтов');
  });

  it('ноль берёт третью форму', () => {
    expect(plural(0, DAY_FORMS)).toBe('дней');
    expect(plural(0, WEEK_FORMS)).toBe('недель');
  });

  // Дробное число приходит у поинтов. В русском оно всегда берёт
  // родительный падеж единственного числа: «1,5 поинта». Склонение по
  // целой части дало бы «1,5 поинт» — так и было, пока не увидел на экране.
  it('дробное всегда берёт родительный падеж единственного числа', () => {
    expect(plural(0.5, POINT_FORMS)).toBe('поинта');
    expect(plural(1.5, POINT_FORMS)).toBe('поинта');
    expect(plural(2.5, POINT_FORMS)).toBe('поинта');
    expect(plural(21.5, POINT_FORMS)).toBe('поинта');
    expect(plural(11.5, POINT_FORMS)).toBe('поинта');
  });

  it('отрицательное склоняет по модулю', () => {
    expect(plural(-1, DAY_FORMS)).toBe('день');
    expect(plural(-5, DAY_FORMS)).toBe('дней');
  });
});

describe('formatNumber', () => {
  it('дробную часть отделяет запятой, как принято по-русски', () => {
    expect(formatNumber(1.5)).toBe('1,5');
    expect(formatNumber(0.25)).toBe('0,25');
  });

  it('целое пишет без дробной части', () => {
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(300)).toBe('300');
  });

  it('округляет до двух знаков', () => {
    expect(formatNumber(1.005)).toBe('1,01');
    expect(formatNumber(1.567)).toBe('1,57');
    expect(formatNumber(1.004)).toBe('1');
  });
});

describe('withPlural', () => {
  it('складывает число и слово', () => {
    expect(withPlural(1, POINT_FORMS)).toBe('1 поинт');
    expect(withPlural(3, POINT_FORMS)).toBe('3 поинта');
    expect(withPlural(8, POINT_FORMS)).toBe('8 поинтов');
  });

  it('дробное пишет с запятой и в родительном падеже', () => {
    expect(withPlural(1.5, POINT_FORMS)).toBe('1,5 поинта');
  });
});
