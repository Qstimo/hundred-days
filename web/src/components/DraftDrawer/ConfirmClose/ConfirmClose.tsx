'use client';

import { Button } from '@/components/ui/button';
import type { IProps } from './types';

/**
 * Вопрос при закрытии панели с несохранённой правкой.
 *
 * Вынесен из панели, чтобы та осталась в пределах своего размера, и потому
 * что это отдельная ответственность: панель знает про черновик, а это — про
 * одно решение пользователя.
 */
export function ConfirmClose({ isOpen, onDiscard, onCancel }: IProps) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Несохранённые изменения"
      className="absolute inset-0 z-10 flex flex-col justify-center gap-4 bg-background/95 p-6"
    >
      <p className="text-sm">
        В форме есть несохранённые изменения. Закрыть и потерять их?
      </p>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={onDiscard}>
          Закрыть без сохранения
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Вернуться к правке
        </Button>
      </div>
    </div>
  );
}
