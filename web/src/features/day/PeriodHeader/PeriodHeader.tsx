import { formatDaysLeft } from '../utils';
import type { IProps } from './types';

/**
 * Шапка периода: заголовок, какой это день и сколько осталось.
 *
 * Полоса нарисована своим элементом, а не Progress из shadcn: тому нужен
 * клиентский компонент ради анимации, а здесь достаточно разметки — шапка
 * остаётся серверной и приходит с первым байтом.
 */
export function PeriodHeader({ period }: IProps) {
  const { title, days, dayNumber, daysLeft } = period;
  const hasStarted = dayNumber > 0;
  const passed = Math.min(dayNumber, days);
  const percent = days > 0 ? Math.round((passed / days) * 100) : 0;

  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <p className="text-sm text-muted-foreground">
        {hasStarted ? (
          <>
            День {dayNumber} из {days}, {formatDaysLeft(daysLeft)}
          </>
        ) : (
          <>Период ещё не начался, {formatDaysLeft(daysLeft)}</>
        )}
      </p>

      <div
        role="progressbar"
        aria-label={`Пройдено ${passed} из ${days}`}
        aria-valuenow={passed}
        aria-valuemin={0}
        aria-valuemax={days}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </header>
  );
}
