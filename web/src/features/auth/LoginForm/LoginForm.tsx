'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IProps } from './types';

/**
 * Форма входа.
 *
 * Сообщение об отказе одно на все случаи: разный текст подсказывал бы, какие
 * логины существуют. То же решение принято на сервере, и расходиться им
 * нельзя.
 */
export function LoginForm({ onSubmit }: IProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const canSubmit = login.trim() !== '' && password !== '' && !isSubmitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setHasError(false);
    setIsSubmitting(true);
    try {
      await onSubmit({ login: login.trim(), password });
    } catch {
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login">Логин</Label>
        <Input
          id="login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {hasError && (
        <p role="alert" className="text-sm text-destructive">
          Логин или пароль не подходят
        </p>
      )}

      <Button type="submit" disabled={!canSubmit}>
        {isSubmitting ? 'Вхожу…' : 'Войти'}
      </Button>
    </form>
  );
}
