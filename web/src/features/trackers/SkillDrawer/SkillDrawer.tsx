'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { DraftDrawer, useDraft } from '@/components/DraftDrawer';
import { TRACKER_FORMS, withPlural } from '@/lib/plural';
import { SkillFields } from './SkillFields';
import type { IProps } from './types';

/**
 * Панель навыка.
 *
 * Предупреждение при удалении говорит правду целиком: трекеры потеряют
 * навык, а отметки и поинты в них останутся. Поинты зафиксированы в момент
 * выполнения, и удаление цели не отменяет сделанной работы.
 */
export function SkillDrawer({
  skill,
  feedingTrackers,
  onSave,
  onDelete,
  onClose,
}: IProps) {
  const initial = useMemo(
    () => ({
      title: skill?.title ?? '',
      targetPoints: skill ? String(skill.targetPoints) : '100',
      unitLabel: skill?.unitLabel ?? '',
    }),
    [skill],
  );
  const { draft, isDirty, setField } = useDraft(initial);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (skill === undefined) return null;

  const isNew = skill === null;
  const target = Number(draft.targetPoints.replace(',', '.'));
  const isValid = draft.title.trim() !== '' && Number.isFinite(target) && target > 0;

  return (
    <DraftDrawer
      isOpen
      title={isNew ? 'Новый навык' : 'Навык'}
      isDirty={(isDirty || isNew) && isValid}
      onSave={() =>
        onSave({
          title: draft.title.trim(),
          targetPoints: target,
          unitLabel: draft.unitLabel.trim(),
        })
      }
      onClose={onClose}
    >
      <SkillFields draft={draft} isValid={isValid} onChange={setField} />

      {!isNew && feedingTrackers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Питают навык: {feedingTrackers.map((t) => t.title).join(', ')}
        </p>
      )}

      {!isNew && onDelete && (
        <Button
          variant="destructive"
          className="self-start"
          onClick={() => setIsConfirmingDelete(true)}
        >
          Удалить навык
        </Button>
      )}

      <ConfirmDelete
        isOpen={isConfirmingDelete}
        what={`навык «${skill?.title ?? ''}»`}
        consequence={
          feedingTrackers.length > 0
            ? `${withPlural(feedingTrackers.length, TRACKER_FORMS)} потеряют навык, но отметки и поинты в них останутся.`
            : 'Трекеров у него нет.'
        }
        onConfirm={() => {
          setIsConfirmingDelete(false);
          void onDelete?.();
        }}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </DraftDrawer>
  );
}
