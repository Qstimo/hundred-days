import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackerTable } from './TrackerTable';
import type { Skill, Tracker } from '../hooks';

const skills: Skill[] = [
  { id: 7, title: 'Английский', targetPoints: 300, unitLabel: '', sortOrder: 0, archived: false },
];

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 1,
    title: 'Занятие',
    mode: 'check',
    pointsRule: 'per_check',
    pointsValue: 1,
    skillId: 7,
    weeklyTarget: 3,
    sortOrder: 0,
    archived: false,
    entryCount: 12,
    ...overrides,
  };
}

describe('TrackerTable', () => {
  it('показывает трекер с его настройками', () => {
    render(
      <TrackerTable
        trackers={[tracker()]}
        skills={skills}
        onEdit={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText('Занятие')).toBeInTheDocument();
    expect(screen.getByText(/3 раз в неделю/)).toBeInTheDocument();
    expect(screen.getByText(/1 поинт за выполнение/)).toBeInTheDocument();
    expect(screen.getByText(/навык: Английский/)).toBeInTheDocument();
    expect(screen.getByText(/12 отметок/)).toBeInTheDocument();
  });

  it('у трекера без навыка показывает прочерк', () => {
    render(
      <TrackerTable
        trackers={[tracker({ skillId: null })]}
        skills={skills}
        onEdit={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText(/навык: —/)).toBeInTheDocument();
  });

  it('правило «за час» называет часом', () => {
    render(
      <TrackerTable
        trackers={[tracker({ mode: 'check_hours', pointsRule: 'per_hour', pointsValue: 1.5 })]}
        skills={skills}
        onEdit={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText(/1,5 поинта за час/)).toBeInTheDocument();
  });

  it('пустой реестр объясняет, что такое трекер', () => {
    render(
      <TrackerTable trackers={[]} skills={[]} onEdit={vi.fn()} onCreate={vi.fn()} />,
    );

    expect(screen.getByText(/отмечается каждый день/i)).toBeInTheDocument();
  });

  it('открывает правку', async () => {
    const onEdit = vi.fn();
    const t = tracker();
    render(
      <TrackerTable trackers={[t]} skills={skills} onEdit={onEdit} onCreate={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Правка' }));

    expect(onEdit).toHaveBeenCalledWith(t);
  });

  it('открывает создание', async () => {
    const onCreate = vi.fn();
    render(
      <TrackerTable trackers={[]} skills={[]} onEdit={vi.fn()} onCreate={onCreate} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Завести трекер' }));

    expect(onCreate).toHaveBeenCalled();
  });
});
