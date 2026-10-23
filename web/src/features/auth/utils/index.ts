/**
 * Утилиты входа, безопасные для клиента.
 *
 * requireUser сюда не входит нарочно: он читает cookies() через
 * next/headers, и один barrel на двоих утянул бы серверный код в клиентский
 * бандл — сборка падает с «You're importing a component that needs
 * next/headers». Серверная половина живёт в ../server.ts и помечена
 * `import 'server-only'`, чтобы ошибка, если её кто-то импортирует из
 * клиента, называла причину сразу.
 */
export { login, logout } from './login';
export { isRegistrationOpen, register } from './register';
