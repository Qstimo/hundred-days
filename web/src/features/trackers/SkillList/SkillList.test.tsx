import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillList } from './SkillList';
import type { Skill, Tracker } from '../hooks';

const skill: Skill = {
  id: 7,
  title: 'Английский',
  targetPoints: 300,
  unitLabel: 'занятие',
  sortOrder: 0,
  archived: false,
};

function tracker(id: number, skillId: number | null): Tracker {
  return {
    id,
    title: `Трекер ${id}`,
    mode: 'check',
    pointsRule: 'per_check',
    pointsValue: 1,
    skillId,
    weeklyTarget: 3,
    sortOrder: 0,
    archived: false,
    entryCount: 0,
  };
}

describe('SkillList', () => {
  it('показывает цель и число питающих трекеров', () => {
    render(
      <SkillList
        skills={[skill]}
        trackers={[tracker(1, 7), tracker(2, 7), tracker(3, null)]}
        onEdit={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText('Английский')).toBeInTheDocument();
    expect(screen.getByText(/цель 300 поинтов/)).toBeInTheDocument();
    expect(screen.getByText(/питают 2 трекера/)).toBeInTheDocument();
  });

  it('показывает подпись единицы, когда она задана', () => {
    render(
      <SkillList skills={[skill]} trackers={[]} onEdit={vi.fn()} onCreate={vi.fn()} />,
    );

    expect(screen.getByText(/единица: занятие/)).toBeInTheDocument();
  });

  it('без подписи единицы её не показывает', () => {
    render(
      <SkillList
        skills={[{ ...skill, unitLabel: '' }]}
        trackers={[]}
        onEdit={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.queryByText(/единица:/)).not.toBeInTheDocument();
  });

  it('пустой реестр объясняет, что такое навык', () => {
    render(<SkillList skills={[]} trackers={[]} onEdit={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByText(/цель в поинтах, которую питают трекеры/i)).toBeInTheDocument();
  });

  it('открывает правку и создание', async () => {
    const onEdit = vi.fn();
    const onCreate = vi.fn();
    render(
      <SkillList skills={[skill]} trackers={[]} onEdit={onEdit} onCreate={onCreate} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Правка' }));
    expect(onEdit).toHaveBeenCalledWith(skill);

    await userEvent.click(screen.getByRole('button', { name: 'Завести навык' }));
    expect(onCreate).toHaveBeenCalled();
  });
});
