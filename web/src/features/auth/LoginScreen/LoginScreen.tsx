'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '../LoginForm';
import { login } from '../utils';
import type { ILoginValues } from '../LoginForm';

/**
 * Экран входа: форма плюс переход на главную после удачи.
 *
 * Переход делается router.replace, а не push: страница входа не должна
 * оставаться в истории, иначе кнопка «назад» вернёт на неё уже вошедшего.
 */
export function LoginScreen() {
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
    </div>
  );
}
