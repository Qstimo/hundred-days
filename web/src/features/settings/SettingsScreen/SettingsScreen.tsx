'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DAY_FORMS, withPlural } from '@/lib/plural';
import { formatDayMonth, formatDaysLeft, formatRussianDate } from '@/features/day/utils';
import { SettingsDrawer } from '../SettingsDrawer';
import { useMutationSettings, useQuerySettings } from '../hooks';
import { periodEnd } from '../SettingsDrawer/utils';
import type { IProps } from './types';

/**
 * Экран настроек: паспорт периода и тумблер сна.
 *
 * Смены пароля здесь нет: в контракте API такой ручки нет, пароль меняется
 * командой `set-password` на сервере. Это записано в дизайне как
 * осознанный долг, а не забыто.
 */
export function SettingsScreen({ initialSettings }: IProps) {
  const query = useQuerySettings(initialSettings);
  const mutation = useMutationSettings();
  const [isEditing, setIsEditing] = useState(false);

  const settings = query.data?.settings;
  const period = query.data?.period;
  const end = settings ? periodEnd(settings.periodStart, settings.periodDays) : null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-4 pb-24 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <Link href="/" className="text-sm underline">
          К сегодняшнему дню
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Период</h2>
          <Button size="sm" onClick={() => setIsEditing(true)} disabled={!settings}>
            Правка
          </Button>
        </div>

        {settings && period ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Заголовок</dt>
              <dd>{settings.periodTitle}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Начало</dt>
              <dd>{formatRussianDate(settings.periodStart)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Длительность</dt>
              <dd>
                {withPlural(settings.periodDays, DAY_FORMS)}
                {end && `, до ${formatDayMonth(end)}`}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Сейчас</dt>
              <dd>
                {period.dayNumber > 0 ? `день ${period.dayNumber}, ` : ''}
                {formatDaysLeft(period.daysLeft)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Блок сна</dt>
              <dd>{settings.sleepEnabled ? 'показывается' : 'скрыт'}</dd>
            </div>
          </dl>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            Не вышло загрузить настройки
          </p>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Пароль меняется командой на сервере: в приложении такой страницы нет.
      </p>

      <SettingsDrawer
        settings={isEditing ? settings : undefined}
        onSave={async (next) => {
          await mutation.mutateAsync(next);
          setIsEditing(false);
        }}
        onClose={() => setIsEditing(false)}
      />
    </main>
  );
}
