import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PeriodHeader } from './PeriodHeader';

const period = {
  title: '100 дней до запуска',
  start: '2026-10-01',
  days: 100,
  today: '2026-10-23',
  dayNumber: 23,
  daysLeft: 78,
};

describe('PeriodHeader', () => {
  it('показывает заголовок периода', () => {
    render(<PeriodHeader period={period} />);

    expect(screen.getByText('100 дней до запуска')).toBeInTheDocument();
  });

  it('показывает номер дня и остаток со склонением', () => {
    render(<PeriodHeader period={period} />);

    expect(screen.getByText(/День 23 из 100/)).toBeInTheDocument();
    expect(screen.getByText(/осталось 78 дней/)).toBeInTheDocument();
  });

  it('склоняет остаток в один день', () => {
    render(<PeriodHeader period={{ ...period, dayNumber: 100, daysLeft: 1 }} />);

    expect(screen.getByText(/остался 1 день/)).toBeInTheDocument();
  });

  it('кончившийся период называет завершённым', () => {
    render(<PeriodHeader period={{ ...period, dayNumber: 101, daysLeft: 0 }} />);

    expect(screen.getByText(/период завершён/)).toBeInTheDocument();
  });

  it('не начавшийся период не показывает нулевой день', () => {
    render(<PeriodHeader period={{ ...period, dayNumber: 0, daysLeft: 100 }} />);

    expect(screen.queryByText(/День 0/)).not.toBeInTheDocument();
    expect(screen.getByText(/ещё не начался/)).toBeInTheDocument();
  });

  it('полоса показывает долю пройденного и доступна чтению', () => {
    render(<PeriodHeader period={period} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '23');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAccessibleName(/пройдено/i);
  });
});
