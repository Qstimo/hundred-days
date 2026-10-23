import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatTiles } from './StatTiles';
import type { StatsResponse, StatsTracker } from '../hooks';

function tracker(overrides: Partial<StatsTracker> = {}): StatsTracker {
  return {
    trackerId: 1,
    title: 'Занятие',
    mode: 'check',
    weeklyTarget: 3,
    days: [],
    totalDone: 6,
    totalHours: 0,
    totalPoints: 6,
    completionRate: 1,
    currentStreak: 2,
    bestStreak: 3,
    currentWeekDone: 1,
    ...overrides,
  };
}

function stats(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    from: '2026-09-24',
    to: '2026-10-23',
    trackers: [tracker()],
    skills: [],
    sleep: [],
    plans: { total: 4, done: 1, rate: 0.25 },
    ...overrides,
  };
}

describe('StatTiles', () => {
  it('показывает самую длинную текущую серию в неделях', () => {
    render(<StatTiles stats={stats()} rangeDays={30} />);

    expect(screen.getByText('2 недели')).toBeInTheDocument();
    expect(screen.getByText(/Занятие, лучшая — 3/)).toBeInTheDocument();
  });

  it('выбирает трекер с самой длинной серией', () => {
    render(
      <StatTiles
        stats={stats({
          trackers: [
            tracker({ title: 'Короткая', currentStreak: 1 }),
            tracker({ trackerId: 2, title: 'Длинная', currentStreak: 5 }),
          ],
        })}
        rangeDays={30}
      />,
    );

    expect(screen.getByText(/Длинная/)).toBeInTheDocument();
  });

  it('показывает выполнение в процентах', () => {
    render(
      <StatTiles
        stats={stats({ trackers: [tracker({ completionRate: 0.75 })] })}
        rangeDays={30}
      />,
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('показывает долю закрытых планов', () => {
    render(<StatTiles stats={stats()} rangeDays={30} />);

    expect(screen.getByText('25%')).toBeInTheDocument();
    // «4 пункта», а не «4 пунктов»: числа 2–4 берут родительный падеж
    // единственного числа.
    expect(screen.getByText(/1 из 4 пункта/)).toBeInTheDocument();
  });

  it('без планов ставит прочерк, а не ноль процентов', () => {
    render(
      <StatTiles stats={stats({ plans: { total: 0, done: 0, rate: 0 } })} rangeDays={30} />,
    );

    expect(screen.getByText('планов за отрезок не было')).toBeInTheDocument();
  });

  it('без трекеров не падает', () => {
    render(<StatTiles stats={stats({ trackers: [] })} rangeDays={30} />);

    expect(screen.getByText('трекеров нет')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
