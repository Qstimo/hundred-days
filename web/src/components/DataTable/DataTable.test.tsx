import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';

interface IRow {
  date: string;
  hours: number;
}

const rows: IRow[] = [
  { date: '2026-10-20', hours: 1.5 },
  { date: '2026-10-21', hours: 2 },
];

const columns = [
  { header: 'Дата', cell: (r: IRow) => r.date },
  { header: 'Часы', cell: (r: IRow) => r.hours, isNumeric: true },
];

describe('DataTable', () => {
  it('подписана для чтения с экрана', () => {
    render(<DataTable caption="Часы по дням" columns={columns} rows={rows} />);

    expect(screen.getByRole('table', { name: 'Часы по дням' })).toBeInTheDocument();
  });

  it('показывает заголовки и строки', () => {
    render(<DataTable caption="Часы по дням" columns={columns} rows={rows} />);

    expect(screen.getByRole('columnheader', { name: 'Дата' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('2026-10-20')).toBeInTheDocument();
  });

  // В столбце числа должны стоять друг под другом.
  it('числа выровнены вправо и набраны цифрами одной ширины', () => {
    render(<DataTable caption="Часы по дням" columns={columns} rows={rows} />);

    const cell = screen.getByText('1.5');
    expect(cell).toHaveClass('text-right');
    expect(cell).toHaveClass('tabular-nums');
  });

  it('пустые строки таблицу не ломают', () => {
    render(<DataTable caption="Пусто" columns={columns} rows={[]} />);

    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});
