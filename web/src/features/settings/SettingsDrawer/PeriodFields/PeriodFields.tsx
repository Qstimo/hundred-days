'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRussianDate } from '@/features/day/utils';
import type { IProps } from './types';

/** Поля периода: заголовок, начало, длительность, тумблер сна. */
export function PeriodFields({ draft, willShiftDayNumber, end, onChange }: IProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="period-title">Заголовок</Label>
        <Input
          id="period-title"
          value={draft.periodTitle}
          onChange={(e) => onChange('periodTitle', e.target.value)}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="period-start">Дата начала</Label>
        <Input
          id="period-start"
          type="date"
          value={draft.periodStart}
          onChange={(e) => onChange('periodStart', e.target.value)}
        />
        {willShiftDayNumber && (
          <span role="alert" className="text-xs text-muted-foreground">
            Смена даты начала сдвинет номер сегодняшнего дня
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="period-days">Длительность в днях</Label>
        <Input
          id="period-days"
          type="number"
          min="1"
          max="3650"
          value={draft.periodDays}
          onChange={(e) => onChange('periodDays', e.target.value)}
        />
        {end && (
          <span className="text-xs text-muted-foreground">
            Кончится {formatRussianDate(end)}
          </span>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.sleepEnabled}
          onChange={(e) => onChange('sleepEnabled', e.target.checked)}
        />
        Показывать блок сна
      </label>
    </>
  );
}
