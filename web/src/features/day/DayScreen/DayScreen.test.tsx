import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DayScreen } from './DayScreen';
import type { DayResponse } from '../hooks';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/api-client', () => ({
  apiClient: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

function day(overrides: Partial<DayResponse> = {}): DayResponse {
  return {
    date: '2026-10-23',
    period: {
      title: '100 дней до',
      start: '2026-10-01',
      days: 100,
      today: '2026-10-23',
      dayNumber: 23,
      daysLeft: 78,
    },
    sleepEnabled: true,
    sleep: null,
    trackers: [
      {
        tracker: {
          id: 1,
          title: 'Занятие',
          mode: 'check',
          pointsRule: 'per_check',
          pointsValue: 1,
          weeklyTarget: 3,
          sortOrder: 0,
          archived: false,
          entryCount: 0,
        },
        entry: null,
        weekDone: 2,
        weekTarget: 3,
      },
    ],
    plans: [{ id: 1, date: '2026-10-23', title: 'Написать план', done: false, sortOrder: 0 }],
    carryOverAvailable: false,
    skills: [
      {
        skill: {
          id: 1,
          title: 'Английский',
          targetPoints: 300,
          unitLabel: '',
          sortOrder: 0,
          archived: false,
        },
        earnedPoints: 7,
      },
    ],
    ...overrides,
  };
}

function renderScreen(initialDay: DayResponse, date?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DayScreen initialDay={initialDay} date={date} />
    </QueryClientProvider>,
  );
}

describe('DayScreen', () => {
  it('показывает шапку периода, трекеры, планы, сон и навыки', () => {
    renderScreen(day());

    expect(screen.getByText('100 дней до')).toBeInTheDocument();
    expect(screen.getByText(/День 23 из 100/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Трекеры' })).toBeInTheDocument();
    expect(screen.getByText('Занятие')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Планы на день' })).toBeInTheDocument();
    expect(screen.getByText('Написать план')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сон' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Навыки' })).toBeInTheDocument();
  });

  it('не показывает блок сна, когда он выключен в настройках', () => {
    renderScreen(day({ sleepEnabled: false }));

    expect(screen.queryByRole('heading', { name: 'Сон' })).not.toBeInTheDocument();
  });

  it('показывает навигацию по датам', () => {
    renderScreen(day());

    expect(screen.getByRole('navigation', { name: /переход по датам/i })).toBeInTheDocument();
  });

  // Отметить будущий день нельзя: сервер отвергает такую запись, и галочки
  // должны быть выключены, а не отправлять запрос в отказ.
  it('в будущем дне отметки выключены', () => {
    renderScreen(
      day({
        date: '2026-11-01',
        period: {
          title: '100 дней до',
          start: '2026-10-01',
          days: 100,
          today: '2026-10-23',
          dayNumber: 23,
          daysLeft: 78,
        },
      }),
      '2026-11-01',
    );

    expect(screen.getByRole('checkbox', { name: 'Занятие' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('в сегодняшнем дне отметки доступны', () => {
    renderScreen(day());

    expect(screen.getByRole('checkbox', { name: 'Занятие' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
