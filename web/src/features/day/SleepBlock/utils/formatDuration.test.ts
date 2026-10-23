import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('пишет часы и минуты', () => {
    expect(formatDuration(450)).toBe('7 ч 30 мин');
    expect(formatDuration(361)).toBe('6 ч 1 мин');
  });

  it('ровные часы пишет без минут', () => {
    expect(formatDuration(480)).toBe('8 ч');
    expect(formatDuration(60)).toBe('1 ч');
  });

  it('меньше часа пишет нулём часов', () => {
    expect(formatDuration(45)).toBe('0 ч 45 мин');
  });

  it('сутки остаются сутками, а не нулём', () => {
    expect(formatDuration(1440)).toBe('24 ч');
  });
});
