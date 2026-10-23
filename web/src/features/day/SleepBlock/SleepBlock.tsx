'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QualitySelect } from '../QualitySelect';
import { useMutationSleep } from '../hooks';
import { formatDuration } from './utils';
import type { IProps } from './types';

/**
 * Блок сна: во сколько лёг, во сколько встал, оценка.
 *
 * Поля времени — браузерные `type="time"`: свой ввод пришлось бы проверять и
 * объяснять, а этот уже умеет и то и другое, включая клавиатуру и мобильную
 * раскладку.
 *
 * Запись уходит по уходу фокуса, а не по каждой набранной цифре: иначе на
 * «23:40» ушло бы четыре запроса, и три из них с неполным временем.
 */
export function SleepBlock({ sleep, date }: IProps) {
  const mutation = useMutationSleep(date);

  const [bed, setBed] = useState(sleep?.wentToBedAt ?? '');
  const [wake, setWake] = useState(sleep?.wokeUpAt ?? '');
  const [quality, setQuality] = useState(sleep?.quality ?? null);

  // Смена дня переоткрывает блок с данными нового дня: без этого поля
  // остались бы от предыдущего.
  useEffect(() => {
    setBed(sleep?.wentToBedAt ?? '');
    setWake(sleep?.wokeUpAt ?? '');
    setQuality(sleep?.quality ?? null);
  }, [sleep?.wentToBedAt, sleep?.wokeUpAt, sleep?.quality]);

  function save(next: { bed?: string; wake?: string; quality?: number | null }) {
    mutation.mutate({
      wentToBedAt: emptyToNull(next.bed ?? bed),
      wokeUpAt: emptyToNull(next.wake ?? wake),
      quality: next.quality !== undefined ? next.quality : quality,
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Сон</h2>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sleep-bed">Лёг</Label>
          <Input
            id="sleep-bed"
            type="time"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
            onBlur={() => save({})}
            className="w-28"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sleep-wake">Встал</Label>
          <Input
            id="sleep-wake"
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            onBlur={() => save({})}
            className="w-28"
          />
        </div>

        <QualitySelect
          value={quality}
          onChange={(next) => {
            setQuality(next);
            save({ quality: next });
          }}
        />

        {sleep?.durationMinutes != null && (
          <p className="text-sm text-muted-foreground">
            Сон: {formatDuration(sleep.durationMinutes)}
          </p>
        )}
      </div>
    </section>
  );
}

/** Пустая строка — отсутствие времени, а не полночь. */
function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}
