import type { IProps } from './types';

/**
 * Табличный двойник графика.
 *
 * Есть у каждого графика, и это не украшение: цвет не должен быть
 * единственным способом прочитать значение. Подсказка при наведении
 * дополняет, но не заменяет — её не видно ни с клавиатуры без фокуса, ни на
 * распечатке, ни тому, кто цвета не различает.
 *
 * Числа выровнены по правому краю и набраны цифрами одной ширины: в столбце
 * они должны стоять друг под другом.
 */
export function DataTable<T>({ caption, columns, rows }: IProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={
                  c.isNumeric
                    ? 'px-2 py-1.5 text-right font-medium text-muted-foreground'
                    : 'px-2 py-1.5 text-left font-medium text-muted-foreground'
                }
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={
                    c.isNumeric
                      ? 'px-2 py-1.5 text-right tabular-nums'
                      : 'px-2 py-1.5 text-left'
                  }
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
