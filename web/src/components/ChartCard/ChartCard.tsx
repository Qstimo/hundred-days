'use client';

import { useState } from 'react';
import type { IProps } from './types';

/**
 * Карточка графика с табличным двойником.
 *
 * Таблица есть у каждого графика и переключается кнопкой. Это не удобство, а
 * условие: цвет не должен быть единственным способом прочитать значение, а
 * подсказки при наведении не видно ни на распечатке, ни тому, кто цвета не
 * различает.
 *
 * При загрузке свежих данных кадр держится на месте приглушённым: скелет
 * вместо графика дёргал бы разметку на каждой смене отрезка.
 */
export function ChartCard({ title, hint, isRefreshing, children, table }: IProps) {
  const [isTable, setIsTable] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>

        <button
          type="button"
          aria-pressed={isTable}
          onClick={() => setIsTable((v) => !v)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          {isTable ? 'График' : 'Таблица'}
        </button>
      </div>

      <div className={isRefreshing ? 'opacity-60 transition-opacity' : undefined}>
        {isTable ? table : children}
      </div>
    </section>
  );
}
