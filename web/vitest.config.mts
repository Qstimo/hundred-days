import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Настройка Vitest.
 *
 * jsdom закреплён на 29: тридцатая версия с Vitest 5 не стартует вовсе —
 * воркер падает с «Cannot read properties of undefined (reading 'bind')».
 * Ограничения в peerDependencies у Vitest нет, поэтому pnpm молча поставил
 * несовместимую пару, и поймать это можно только запуском.
 *
 * Путь настройки — .mts: как .ts он грузится загрузчиком CommonJS, и Vite
 * предупреждает, что в следующем мажоре это перестанет работать.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Источник страницы задан: по умолчанию jsdom живёт на about:blank, и
    // относительный адрес вроде «/api/health» не к чему привязать — запрос
    // падает ещё до отправки. В браузере такой адрес разрешается от
    // источника страницы, и тесты должны видеть то же самое.
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['node_modules/**', '.next/**'],
  },
  resolve: {
    // Путь собирается из import.meta.dirname, а не из URL.pathname: в пути
    // этого проекта есть пробел и кириллица, и pathname отдал бы его
    // процентно-закодированным — такого каталога на диске нет, и алиас
    // молча перестал бы разрешаться.
    alias: { '@': path.join(import.meta.dirname, 'src') },
  },
});
