'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { compareISODate, formatRussianDate, shiftISODate } from '../utils';
import type { IProps } from './types';

/**
 * Переход по датам.
 *
 * Дата живёт в адресе, а не в состоянии: страницу дня должно быть можно
 * открыть ссылкой, переслать себе и вернуться к ней кнопкой «назад».
 *
 * Возврат к сегодня уходит на адрес без параметра: какой день сегодняшний,
 * решает сервер по своей зоне, и подставлять сюда дату из браузера значило
 * бы завести второй источник правды.
 */
export function DateNavigator({ date, today }: IProps) {
  const router = useRouter();
  const isToday = date === today;
  const canGoForward = compareISODate(date, today) < 0;

  return (
    <nav className="flex items-center gap-2" aria-label="Переход по датам">
      <Button
        variant="outline"
        size="icon"
        aria-label="Предыдущий день"
        onClick={() => router.push(`/?date=${shiftISODate(date, -1)}`)}
      >
        ←
      </Button>

      <span className="min-w-48 text-center text-sm font-medium">
        {formatRussianDate(date, today)}
      </span>

      <Button
        variant="outline"
        size="icon"
        aria-label="Следующий день"
        disabled={!canGoForward}
        onClick={() => router.push(`/?date=${shiftISODate(date, 1)}`)}
      >
        →
      </Button>

      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          Сегодня
        </Button>
      )}
    </nav>
  );
}
