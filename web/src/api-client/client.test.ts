import { describe, expect, it } from 'vitest';
import { API_BASE_URL, isUnauthorized } from './client';

describe('API_BASE_URL', () => {
  // Через сам fetch это свойство здесь не проверить: глобальный Request в
  // тестах — узлов, от undici, и относительные адреса он не разрешает
  // независимо от источника страницы в jsdom. Поэтому проверяется адрес,
  // из которого клиент собран, — он единственный источник этого решения.
  it('относительный: cookie сессии уходит только в свой источник', () => {
    expect(API_BASE_URL.startsWith('/')).toBe(true);
    expect(API_BASE_URL).not.toMatch(/^[a-z]+:\/\//i);
  });

  it('ведёт на префикс, который раздаёт прокси', () => {
    expect(API_BASE_URL).toBe('/api');
  });
});

describe('isUnauthorized', () => {
  it('узнаёт ответ без сессии по коду 401', () => {
    expect(isUnauthorized({ response: { status: 401 } })).toBe(true);
  });

  it('не путает с другими отказами', () => {
    expect(isUnauthorized({ response: { status: 404 } })).toBe(false);
    expect(isUnauthorized({ response: { status: 422 } })).toBe(false);
    expect(isUnauthorized({ response: { status: 500 } })).toBe(false);
  });

  it('не падает на том, что ответом не является', () => {
    expect(isUnauthorized(new Error('сеть отвалилась'))).toBe(false);
    expect(isUnauthorized(null)).toBe(false);
    expect(isUnauthorized(undefined)).toBe(false);
    expect(isUnauthorized('строка')).toBe(false);
    expect(isUnauthorized({})).toBe(false);
  });
});
