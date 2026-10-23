'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { DraftDrawer, useDraft } from '@/components/DraftDrawer';
import { ENTRY_FORMS, withPlural } from '@/lib/plural';
import { TrackerFields } from './TrackerFields';
import { draftFromTracker, isDraftValid, trackerInputFromDraft } from './utils';
import type { IProps } from './types';

/**
 * Панель трекера: создание и правка.
 *
 * Удаление спрашивает подтверждение и называет, сколько отметок унесёт:
 * число приходит с сервера полем entryCount. Удаление, молча уносящее
 * историю, однажды окажется неприятной неожиданностью.
 */
export function TrackerDrawer({ tracker, skills, onSave, onDelete, onClose }: IProps) {
  const initial = useMemo(() => draftFromTracker(tracker), [tracker]);
  const { draft, isDirty, setField } = useDraft(initial);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (tracker === undefined) return null;

  const isNew = tracker === null;
  const entryCount = tracker?.entryCount ?? 0;

  return (
    <DraftDrawer
      isOpen
      title={isNew ? 'Новый трекер' : 'Трекер'}
      isDirty={(isDirty || isNew) && isDraftValid(draft)}
      onSave={() => onSave(trackerInputFromDraft(draft))}
      onClose={onClose}
    >
      <TrackerFields draft={draft} skills={skills} onChange={setField} />

      {!isNew && onDelete && (
        <Button
          variant="destructive"
          className="self-start"
          onClick={() => setIsConfirmingDelete(true)}
        >
          Удалить трекер
        </Button>
      )}

      <ConfirmDelete
        isOpen={isConfirmingDelete}
        what={`трекер «${tracker?.title ?? ''}»`}
        consequence={
          entryCount > 0
            ? `Вместе с ним уйдут ${withPlural(entryCount, ENTRY_FORMS)}.`
            : 'Отметок у него пока нет.'
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
