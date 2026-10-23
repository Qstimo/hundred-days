'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './constants';

/**
 * Навигация по разделам.
 *
 * Пока её не было, экран занятий находился только по ссылке из пустого
 * состояния на странице дня — то есть исчезал ровно тогда, когда трекеры
 * появлялись. Раздел, в который нельзя попасть, всё равно что отсутствует.
 *
 * Текущий раздел помечен и подписью для чтения с экрана, а не только
 * цветом: цвет не должен быть единственным признаком.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы"
      className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-sm"
    >
      <ul className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-3 py-2 sm:px-6">
        {NAV_ITEMS.map((item) => {
          const isCurrent =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={
                  isCurrent
                    ? 'rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary'
                    : 'rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
