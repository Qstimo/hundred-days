import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillMeters } from './SkillMeters';
import type { StatsSkill } from '../hooks';

function skill(overrides: Partial<StatsSkill> = {}): StatsSkill {
  return {
    skillId: 1,
    title: 'Английский',
    unitLabel: 'занятие',
    targetPoints: 300,
    earnedPoints: 7,
    pacePerDay: 0.5,
    forecast: 46,
    willReach: false,
    ...overrides,
  };
}

describe('SkillMeters', () => {
  it('показывает забранное и цель', () => {
    render(<SkillMeters skills={[skill()]} />);

    expect(screen.getByText('Английский')).toBeInTheDocument();
    expect(screen.getByText('7 из 300')).toBeInTheDocument();
  });

  it('дорожка доступна чтению', () => {
    render(<SkillMeters skills={[skill({ earnedPoints: 150 })]} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(bar).toHaveAttribute('aria-valuemax', '300');
  });

  it('подписывает прогноз и успеваемость', () => {
    render(<SkillMeters skills={[skill()]} />);

    expect(
      screen.getByText(/при темпе 0,5 в день — 46 к концу периода, цель не успевает/),
    ).toBeInTheDocument();
  });

  it('достижимую цель называет взятой', () => {
    render(<SkillMeters skills={[skill({ targetPoints: 20, willReach: true })]} />);

    expect(screen.getByText(/цель будет взята/)).toBeInTheDocument();
  });

  it('без темпа так и говорит, а не показывает ноль', () => {
    render(<SkillMeters skills={[skill({ pacePerDay: 0, forecast: 7 })]} />);

    expect(screen.getByText(/темпа за последние две недели нет/)).toBeInTheDocument();
  });

  // Метка прогноза стоит на той же дорожке: она отвечает на «успею ли», и
  // выносить её во второй график значило бы разорвать один вопрос на два.
  it('метка прогноза стоит дальше залитой части', () => {
    render(<SkillMeters skills={[skill({ earnedPoints: 30, forecast: 150 })]} />);

    const fill = screen.getByTestId('meter-fill-1');
    const forecast = screen.getByTestId('meter-forecast-1');

    expect(fill).toHaveStyle({ width: '10%' });
    expect(forecast).toHaveStyle({ left: '50%' });
  });

  it('прогноз сверх цели метку не рисует: дорожка уже полна', () => {
    render(<SkillMeters skills={[skill({ earnedPoints: 30, forecast: 400 })]} />);

    expect(screen.queryByTestId('meter-forecast-1')).not.toBeInTheDocument();
  });

  it('перевыполнение дорожку не рвёт', () => {
    render(<SkillMeters skills={[skill({ earnedPoints: 400 })]} />);

    expect(screen.getByTestId('meter-fill-1')).toHaveStyle({ width: '100%' });
  });

  it('не делит на ноль при негодной цели', () => {
    render(<SkillMeters skills={[skill({ targetPoints: 0 })]} />);

    expect(screen.getByTestId('meter-fill-1')).toHaveStyle({ width: '0%' });
  });

  it('пустой список говорит, что навыков нет', () => {
    render(<SkillMeters skills={[]} />);

    expect(screen.getByText('Навыков пока нет')).toBeInTheDocument();
  });
});
