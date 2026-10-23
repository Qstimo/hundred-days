import { describe, expect, it } from 'vitest';
import { parseHours } from './parseHours';

describe('parseHours', () => {
  it('разбирает целое и дробное', () => {
    expect(parseHours('2')).toBe(2);
    expect(parseHours('1.5')).toBe(1.5);
  });

  it('принимает запятую как разделитель', () => {
    expect(parseHours('1,5')).toBe(1.5);
  });

  it('пустое — отсутствие значения', () => {
    expect(parseHours('')).toBeNull();
    expect(parseHours('   ')).toBeNull();
  });

  it('ноль и отрицательное — отсутствие значения, а не ноль часов', () => {
    expect(parseHours('0')).toBeNull();
    expect(parseHours('-1')).toBeNull();
  });

  it('негодный текст — отсутствие значения', () => {
    expect(parseHours('полтора')).toBeNull();
    expect(parseHours('1.2.3')).toBeNull();
  });
});
