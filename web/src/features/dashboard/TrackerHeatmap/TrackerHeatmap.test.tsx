import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackerHeatmap } from './TrackerHeatmap';
import type { StatsTracker } from '../hooks';

function tracker(days: Array<{ date: string; done: boolean; points: number; hours?: number | null }>): StatsTracker {
  return {
    trackerId: 1,
    title: 'Занятие',
    mode: 'check',
    weeklyTarget: 3,
    days,
    totalDone: days.filter((d) => d.done).length,
    totalHours: 0,
    totalPoints: days.reduce((s, d) => s + d.points, 0),
    completionRate: 1,
    currentStreak: 2,
    bestStreak: 3,
    currentWeekDone: 1,
  };
}

const week = [
  { date: '2026-10-19', done: true, points: 1 },
  { date: '2026-10-20', done: false, points: 0 },
  { date: '2026-10-21', done: true, points: 1 },
  { date: '2026-10-22', done: false, points: 0 },
  { date: '2026-10-23', done: true, points: 1 },
  { date: '2026-10-24', done: false, points: 0 },
  { date: '2026-10-25', done: true, points: 1 },
];

describe('TrackerHeatmap', () => {
  it('рисует клетку на каждый день отрезка', () => {
    const { container } = render(<TrackerHeatmap tracker={tracker(week)} />);

    expect(container.querySelectorAll('rect')).toHaveLength(7);
  });

  it('подписана для чтения с экрана', () => {
    render(<TrackerHeatmap tracker={tracker(week)} />);

    expect(
      screen.getByRole('img', { name: /Теплокарта: Занятие, выполнено 4 из 7/ }),
    ).toBeInTheDocument();
  });

  // Значение не заперто в подсказке при наведении: у клетки есть title,
  // она доступна с клавиатуры, а у карточки есть табличный вид.
  it('у каждой клетки подпись с датой и результатом', () => {
    const { container } = render(<TrackerHeatmap tracker={tracker(week)} />);

    const titles = Array.from(container.querySelectorAll('title')).map((t) => t.textContent);

    expect(titles).toContain('19 октября: 1 поинт');
    expect(titles).toContain('20 октября: не сделано');
  });

  it('клетки получают фокус с клавиатуры', () => {
    const { container } = render(<TrackerHeatmap tracker={tracker(week)} />);

    const focusable = container.querySelectorAll('rect[tabindex="0"]');

    expect(focusable).toHaveLength(7);
  });

  // У секвенциальной шкалы легенда обязательна: без неё насыщенность
  // клетки ни о чём не говорит.
  it('показывает шкалу «меньше — больше»', () => {
    render(<TrackerHeatmap tracker={tracker(week)} />);

    expect(screen.getByText('меньше')).toBeInTheDocument();
    expect(screen.getByText('больше')).toBeInTheDocument();
  });

  it('подписывает месяц', () => {
    render(<TrackerHeatmap tracker={tracker(week)} />);

    expect(screen.getByText('октября')).toBeInTheDocument();
  });

  it('у трекера с часами в подписи есть часы', () => {
    const withHours = {
      ...tracker([{ date: '2026-10-19', done: true, points: 3, hours: 1.5 }]),
      mode: 'check_hours' as const,
    };
    const { container } = render(<TrackerHeatmap tracker={withHours} />);

    expect(container.querySelector('title')?.textContent).toBe(
      '19 октября: 1,5 часа, 3 поинта',
    );
  });

  it('сетка не выходит за свою ширину', () => {
    const { container } = render(<TrackerHeatmap tracker={tracker(week)} />);

    const svg = container.querySelector('svg')!;
    const width = Number(svg.getAttribute('width'));
    const lastX = Math.max(
      ...Array.from(container.querySelectorAll('rect')).map(
        (r) => Number(r.getAttribute('x')) + Number(r.getAttribute('width')),
      ),
    );

    expect(lastX).toBeLessThanOrEqual(width);
  });
});
