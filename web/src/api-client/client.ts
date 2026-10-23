import createClient from 'openapi-fetch';
import type { paths } from './schema';

/**
 * Базовый адрес API — относительный, и это важно.
 *
 * Cookie сессии помечена `SameSite=Lax` и уходит только в свой источник.
 * Абсолютный адрес сделал бы запрос межсайтовым, cookie не поехала бы, и
 * приложение молча перестало бы узнавать вошедшего.
 */
export const API_BASE_URL = '/api';

/** Клиент API для браузера. */
export const apiClient = createClient<paths>({ baseUrl: API_BASE_URL });

/**
 * Ответ «нужен вход»: повод отправить на `/login`, а не показать ошибку.
 *
 * Проверка написана защитно, потому что сюда попадает всё, что пришло из
 * `catch`: и отказ сервера, и обрыв сети, и что угодно ещё.
 */
export function isUnauthorized(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { response } = error as { response?: { status?: number } };
  return response?.status === 401;
}
