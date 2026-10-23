'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmClose } from './ConfirmClose';
import type { IProps } from './types';

/**
 * Выезжающая панель с черновиком.
 *
 * Поля собираются в черновик и уходят одной кнопкой «Сохранить» в прилипшей
 * шапке — тот же приём, что в панели версии CAIRN. Закрытие с несохранённой
 * правкой спрашивает подтверждение: панель легко закрыть мимо кнопки, и
 * терять набранное молча нельзя.
 *
 * Неудачное сохранение оставляет панель открытой с сообщением: закрыть её,
 * потеряв и правку, и причину отказа, было бы худшим из возможных ответов.
 */
export function DraftDrawer({
  isOpen,
  title,
  isDirty,
  onSave,
  onClose,
  children,
}: IProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!isOpen) return null;

  function handleClose() {
    if (isDirty) {
      setIsConfirming(true);
      return;
    }
    onClose();
  }

  async function handleSave() {
    setHasError(false);
    setIsSaving(true);
    try {
      await onSave();
      onClose();
    } catch {
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside
      aria-label={title}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-background shadow-lg"
    >
      <header className="sticky top-0 flex items-center justify-between gap-4 border-b bg-background p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving ? 'Сохраняю…' : 'Сохранить'}
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            Закрыть
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {hasError && (
          <p role="alert" className="text-sm text-destructive">
            Не вышло сохранить. Попробуйте ещё раз.
          </p>
        )}
        {children}
      </div>

      <ConfirmClose
        isOpen={isConfirming}
        onDiscard={onClose}
        onCancel={() => setIsConfirming(false)}
      />
    </aside>
  );
}
