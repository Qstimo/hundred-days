import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartCard } from './ChartCard';

function setup(isRefreshing = false) {
  render(
    <ChartCard
      title="Часы"
      hint="по дням"
      isRefreshing={isRefreshing}
      table={<div data-testid="table">таблица</div>}
    >
      <div data-testid="chart">график</div>
    </ChartCard>,
  );
}

describe('ChartCard', () => {
  it('показывает заголовок и пояснение', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Часы' })).toBeInTheDocument();
    expect(screen.getByText('по дням')).toBeInTheDocument();
  });

  it('по умолчанию показывает график', () => {
    setup();

    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  // Цвет не должен быть единственным путём к значению, и подсказки при
  // наведении недостаточно: их не видно ни на распечатке, ни тому, кто
  // цвета не различает.
  it('переключается на таблицу и обратно', async () => {
    setup();

    await userEvent.click(screen.getByRole('button', { name: 'Таблица' }));
    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'График' }));
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });

  it('состояние переключателя доступно чтению', async () => {
    setup();

    const button = screen.getByRole('button', { name: 'Таблица' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'График' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  // Скелет вместо графика дёргал бы разметку на каждой смене отрезка.
  it('при загрузке держит кадр приглушённым, а не прячет его', () => {
    setup(true);

    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart').parentElement).toHaveClass('opacity-60');
  });
});
