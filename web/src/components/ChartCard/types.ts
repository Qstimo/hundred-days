import type { ReactNode } from 'react';

export interface IProps {
  /** Заголовок: он же называет, что отложено, вместо легенды у одной серии. */
  title: string;
  /** Пояснение под заголовком. */
  hint?: string;
  /** Идёт ли загрузка свежих данных: кадр держится приглушённым. */
  isRefreshing?: boolean;
  /** График. */
  children: ReactNode;
  /** Табличный двойник. Обязателен: цвет не должен быть единственным путём к значению. */
  table: ReactNode;
}
