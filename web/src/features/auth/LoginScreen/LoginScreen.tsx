'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginForm } from '../LoginForm';
import { login } from '../utils';
import type { ILoginValues } from '../LoginForm';
import type { IProps } from './types';

/**
 * Экран входа: форма плюс переход на главную после удачи.
 *
 * Переход делается router.replace, а не push: страница входа не должна
 * оставаться в истории, иначе кнопка «назад» вернёт на неё уже вошедшего.
 */
export function LoginScreen({ isRegistrationOpen = false }: IProps) {
  const router = useRouter();

  async function handleSubmit(values: ILoginValues) {
    await login(values);
    router.replace('/');
    // Серверные компоненты держат свой снимок сессии: без этого главная
    // могла бы отрисоваться по прежнему, ещё невошедшему состоянию.
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold">100 дней до</h1>
      <LoginForm onSubmit={handleSubmit} />

      {/* Ссылка показывается только когда регистрация открыта: ссылка на
          страницу, которая всё равно откажет, хуже отсутствующей. */}
      {isRegistrationOpen && (
        <Link href="/register" className="text-sm text-muted-foreground underline">
          Создать первый аккаунт
        </Link>
      )}
    </div>
  );
}
