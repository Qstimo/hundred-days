'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { POINT_FORMS, withPlural } from '@/lib/plural';
import { HoursField } from '../HoursField';
import { parseHours } from './utils';
import type { IProps } from './types';

/**
 * Строка трекера на странице дня: галочка, название, недельный счёт и — у
 * трекера с часами — поле часов.
 *
 * Галочка пишется сразу, без панели: это одно нажатие, и панель для него
 * была бы издевательством. Прочие правки трекера живут на экране реестра.
 */
export function TrackerRow({ item, isEditable, onToggle, onHoursChange }: IProps) {
  const { tracker, entry, weekDone, weekTarget } = item;

  const [hoursText, setHoursText] = useState(
    entry?.hours != null ? String(entry.hours) : '',
  );
  const [hasHoursError, setHasHoursError] = useState(false);

  const isDone = entry != null;
  const wantsHours = tracker.mode === 'check_hours';
  const needsHours = tracker.pointsRule === 'per_hour';
  const hours = parseHours(hoursText);

  function handleToggle() {
    // Отметка «за час» без часов начислила бы ноль: сервер её отвергает, и
    // показать причину здесь честнее, чем отправить запрос в отказ.
    if (!isDone && needsHours && hours == null) {
      setHasHoursError(true);
      return;
    }
    setHasHoursError(false);
    onToggle(wantsHours ? hours : null, !isDone);
  }

  return (
    <li className="flex items-start gap-3 py-3">
      <Checkbox
        checked={isDone}
        disabled={!isEditable}
        onCheckedChange={handleToggle}
        aria-label={tracker.title}
        className="mt-1"
      />

      <div className="flex flex-1 flex-col gap-1">
        <span className="font-medium">{tracker.title}</span>

        <span className="text-xs text-muted-foreground">
          {weekDone} из {weekTarget} на этой неделе
          {isDone && ` · ${withPlural(entry.pointsAwarded, POINT_FORMS)}`}
        </span>

        {hasHoursError && (
          <span role="alert" className="text-xs text-destructive">
            Укажите часы: поинты у этого трекера считаются за час
          </span>
        )}
      </div>

      {wantsHours && (
        <HoursField
          value={hoursText}
          isEditable={isEditable}
          onChange={setHoursText}
          onCommit={() => isDone && onHoursChange(parseHours(hoursText))}
        />
      )}
    </li>
  );
}
