import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillProgressList } from './SkillProgressList';
import type { IProps } from './types';

function skill(
  title: string,
  earned: number,
  target: number,
): IProps['skills'][number] {
  return {
    skill: {
      id: 1,
      title,
      targetPoints: target,
      unitLabel: 'занятие',
      sortOrder: 0,
      archived: false,
    },
    earnedPoints: earned,
  };
}

describe('SkillProgressList', () => {
  it('показывает забранное и цель', () => {
    render(<SkillProgressList skills={[skill('Английский', 7, 300)]} />);

    expect(screen.getByText('Английский')).toBeInTheDocument();
    expect(screen.getByText('7 из 300')).toBeInTheDocument();
  });

  it('полоса доступна чтению', () => {
    render(<SkillProgressList skills={[skill('Английский', 150, 300)]} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(bar).toHaveAttribute('aria-valuemax', '300');
  });

  // Цель всегда больше нуля — это проверяет сервер, — но делить на неё
  // всё равно опасно: один негодный ответ не должен ронять экран.
  it('не делит на ноль при негодной цели', () => {
    render(<SkillProgressList skills={[skill('Странный', 5, 0)]} />);

    expect(screen.getByText('5 из 0')).toBeInTheDocument();
  });

  it('перевыполнение не растягивает полосу за край', () => {
    render(<SkillProgressList skills={[skill('Английский', 400, 300)]} />);

    const fill = screen.getByTestId('skill-fill-1');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('пустой список навыков блок не показывает', () => {
    const { container } = render(<SkillProgressList skills={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('ведёт на дашборд за подробностями', () => {
    render(<SkillProgressList skills={[skill('Английский', 7, 300)]} />);

    expect(screen.getByRole('link', { name: /подробнее/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
