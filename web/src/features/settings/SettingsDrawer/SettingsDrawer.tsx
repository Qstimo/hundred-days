'use client';

import { useMemo } from 'react';
import { DraftDrawer, useDraft } from '@/components/DraftDrawer';
import { PeriodFields } from './PeriodFields';
import { periodEnd } from './utils';
import type { IProps } from './types';

const MAX_PERIOD_DAYS = 3650;

/**
 * Панель настроек периода.
 *
 * Подсказка с датой окончания нужна потому, что «сто дней от 23 октября» —
 * не та информация, которую человек держит в голове. Предупреждение о
 * сдвиге номера дня — потому что узнать об этом после сохранения неприятно.
 */
export function SettingsDrawer({ settings, onSave, onClose }: IProps) {
  const initial = useMemo(
    () => ({
      periodTitle: settings?.periodTitle ?? '',
      periodStart: settings?.periodStart ?? '',
      periodDays: settings ? String(settings.periodDays) : '100',
      sleepEnabled: settings?.sleepEnabled ?? true,
    }),
    [settings],
  );
  const { draft, isDirty, setField } = useDraft(initial);

  if (!settings) return null;

  const days = Number(draft.periodDays);
  const isValid =
    draft.periodTitle.trim() !== '' &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= MAX_PERIOD_DAYS &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.periodStart);

  return (
    <DraftDrawer
      isOpen
      title="Период"
      isDirty={isDirty && isValid}
      onSave={() =>
        onSave({
          periodTitle: draft.periodTitle.trim(),
          periodStart: draft.periodStart,
          periodDays: days,
          sleepEnabled: draft.sleepEnabled,
        })
      }
      onClose={onClose}
    >
      <PeriodFields
        draft={draft}
        willShiftDayNumber={draft.periodStart !== settings.periodStart}
        end={periodEnd(draft.periodStart, days)}
        onChange={setField}
      />
    </DraftDrawer>
  );
}
