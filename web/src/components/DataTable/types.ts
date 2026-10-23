import type { ReactNode } from 'react';

export interface IColumn<T> {
  /** Заголовок столбца. */
  header: string;
  /** Значение ячейки. */
  cell: (row: T) => ReactNode;
  /** Выравнивать по правому краю: так ставятся числа. */
  isNumeric?: boolean;
}

export interface IProps<T> {
  /** Подпись таблицы для чтения с экрана. */
  caption: string;
  /** Столбцы. */
  columns: ReadonlyArray<IColumn<T>>;
  /** Строки. */
  rows: readonly T[];
}
