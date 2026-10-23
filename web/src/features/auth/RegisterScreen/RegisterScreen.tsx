'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RegisterForm } from '../RegisterForm';
import { register } from '../utils';
import type { IRegisterValues } from '../RegisterForm';

/** Экран первого аккаунта. */
export function RegisterScreen() {
  const router = useRouter();
  const [error, setError] = useState<string>();

  async function handleSubmit(values: IRegisterValues) {
    setError(undefined);
    try {
      await register(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло создать аккаунт');
      return;
    }

    router.replace('/');
    // Серверные компоненты держат свой снимок сессии.
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">100 дней до</h1>
        <p className="text-sm text-muted-foreground">
          Первый аккаунт. После него регистрация закроется — следующие
          заводятся командой на сервере.
        </p>
      </div>

      <RegisterForm onSubmit={handleSubmit} error={error} />

      <Link href="/login" className="text-sm text-muted-foreground underline">
        У меня уже есть аккаунт
      </Link>
    </div>
  );
}
