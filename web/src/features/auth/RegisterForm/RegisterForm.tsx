'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MIN_PASSWORD_LENGTH } from './constants';
import type { IProps } from './types';

/**
 * Форма первого аккаунта.
 *
 * Длина пароля проверяется здесь и на сервере. Здесь — чтобы сказать до
 * отправки; там — потому что форму можно обойти.
 *
 * Длина считается в знаках, а не в байтах: восемь русских букв занимают
 * шестнадцать байт, и проверка по длине строки в байтах пропустила бы
 * пароль из четырёх букв.
 */
export function RegisterForm({ onSubmit, error }: IProps) {
  const [login, setLogin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordLength = [...password].length;
  const isPasswordShort = passwordLength > 0 && passwordLength < MIN_PASSWORD_LENGTH;
  const canSubmit =
    login.trim() !== '' && passwordLength >= MIN_PASSWORD_LENGTH && !isSubmitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ login: login.trim(), name: name.trim(), password });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-login">Логин</Label>
        <Input
          id="reg-login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-name">Имя</Label>
        <Input
          id="reg-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="как к вам обращаться"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-password">Пароль</Label>
        <Input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <span
          className={
            isPasswordShort ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
          }
        >
          Не короче {MIN_PASSWORD_LENGTH} знаков
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit}>
        {isSubmitting ? 'Создаю…' : 'Создать аккаунт'}
      </Button>
    </form>
  );
}
