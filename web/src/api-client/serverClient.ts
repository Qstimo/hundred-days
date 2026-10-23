import createClient from 'openapi-fetch';
import { cookies } from 'next/headers';
import type { paths } from './schema';

/**
 * Клиент для серверных компонентов.
 *
 * Ходит во внутренний адрес API напрямую, минуя прокси, и вручную
 * пересылает cookie сессии: серверный запрос исходит не от браузера, и сам
 * он её не приложит.
 */
export async function createServerClient() {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  return createClient<paths>({
    baseUrl: `${process.env.HD_API_INTERNAL_URL ?? 'http://127.0.0.1:3001'}/api`,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    // Данные дня меняются от каждой галочки: кэш ответов здесь только мешал
    // бы. В режиме без Cache Components fetch и так не кэшируется, но
    // сказать это явно дешевле, чем однажды выяснять, почему экран отстал.
    cache: 'no-store',
  });
}
