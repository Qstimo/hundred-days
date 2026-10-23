'use client';

import { Button } from '@/components/ui/button';
import type { IProps } from './types';

/**
 * Подтверждение удаления.
 *
 * Называет, что именно удаляется и что при этом будет унесено, а не
 * спрашивает «вы уверены». Человек не может быть уверен в том, чего ему не
 * сказали.
 */
export function ConfirmDelete({ isOpen, what, consequence, onConfirm, onCancel }: IProps) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Подтверждение удаления"
      className="absolute inset-0 z-20 flex flex-col justify-center gap-4 bg-background/95 p-6"
    >
      <p className="text-sm">
        Удалить {what}?{consequence ? ` ${consequence}` : ''}
      </p>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={onConfirm}>
          Удалить
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
