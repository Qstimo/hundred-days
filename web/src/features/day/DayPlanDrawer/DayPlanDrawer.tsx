'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DraftDrawer, useDraft } from '@/components/DraftDrawer';
import type { IProps } from './types';

/** Панель правки пункта плана: текст и удаление. */
export function DayPlanDrawer({ plan, onSave, onDelete, onClose }: IProps) {
  // Исходные данные мемоизируются: без этого useDraft получал бы новый
  // объект на каждую отрисовку и считал бы черновик изменённым всегда.
  const initial = useMemo(() => ({ title: plan?.title ?? '' }), [plan?.title]);
  const draft = useDraft(initial);

  if (!plan) return null;

  return (
    <DraftDrawer
      isOpen
      title="Пункт плана"
      isDirty={draft.isDirty && draft.draft.title.trim() !== ''}
      onSave={() => onSave(draft.draft.title.trim())}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-title">Текст пункта</Label>
        <Input
          id="plan-title"
          value={draft.draft.title}
          onChange={(e) => draft.setField('title', e.target.value)}
          autoFocus
        />
      </div>

      <Button variant="destructive" onClick={onDelete} className="self-start">
        Удалить
      </Button>
    </DraftDrawer>
  );
}
