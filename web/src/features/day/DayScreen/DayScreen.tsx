'use client';

import { DateNavigator } from '../DateNavigator';
import { DayPlanList } from '../DayPlanList';
import { PeriodHeader } from '../PeriodHeader';
import { SkillProgressList } from '../SkillProgressList';
import { SleepBlock } from '../SleepBlock';
import { TrackerList } from '../TrackerList';
import { useQueryDay } from '../hooks';
import { compareISODate } from '../utils';
import type { IProps } from './types';

/**
 * Страница дня — композиция блоков, своей логики у неё нет.
 *
 * Данные приходят с сервера начальными, дальше экран живёт на TanStack
 * Query: он единственный источник правды, и в состояние компонента эти
 * данные не копируются.
 *
 * Какой день «сегодня», решает сервер: его ответ содержит дату, и она же
 * служит точкой отсчёта для навигации. Брать её из браузера значило бы
 * завести второй источник правды, который разойдётся с первым в полночь.
 */
export function DayScreen({ initialDay }: IProps) {
  // Ключ — разрешённая сервером дата, а не присланный параметр: на главной
  // параметра нет, и ключ «today» разошёлся бы с тем, под который пишут
  // мутации.
  const { data } = useQueryDay(initialDay.date, initialDay);
  const day = data ?? initialDay;

  // Сегодня приходит в периоде: его знает сервер по своей зоне. Выводить
  // арифметикой по номеру дня нельзя — у не начавшегося периода он нулевой,
  // — а брать из браузера значило бы разойтись с сервером в полночь.
  const isFuture = compareISODate(day.date, day.period.today) > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-4 pb-24 sm:p-6">
      <PeriodHeader period={day.period} />

      <DateNavigator date={day.date} today={day.period.today} />

      <TrackerList items={day.trackers} date={day.date} isEditable={!isFuture} />

      <DayPlanList
        plans={day.plans}
        date={day.date}
        carryOverAvailable={day.carryOverAvailable}
      />

      {day.sleepEnabled && <SleepBlock sleep={day.sleep ?? null} date={day.date} />}

      <SkillProgressList skills={day.skills} />
    </main>
  );
}
