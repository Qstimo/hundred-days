import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayPlanItem } from './DayPlanItem';
import type { DayPlan } from '../hooks';

function plan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: 1,
    date: '2026-10-23',
    title: 'Написать план',
    done: false,
    sortOrder: 0,
    ...overrides,
  };
}

describe('DayPlanItem', () => {
  it('показывает текст пункта', () => {
    render(<DayPlanItem plan={plan()} onToggle={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText('Написать план')).toBeInTheDocument();
  });

  it('закрывает пункт галочкой', async () => {
    const onToggle = vi.fn();
    render(<DayPlanItem plan={plan()} onToggle={onToggle} onEdit={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('открывает закрытый пункт повторным нажатием', async () => {
    const onToggle = vi.fn();
    render(
      <DayPlanItem plan={plan({ done: true })} onToggle={onToggle} onEdit={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('закрытый пункт помечен зачёркиванием', () => {
    render(
      <DayPlanItem plan={plan({ done: true })} onToggle={vi.fn()} onEdit={vi.fn()} />,
    );

    expect(screen.getByText('Написать план')).toHaveClass('line-through');
  });

  // Поле carriedFromId существует ровно для этого: в сегодняшнем дне видно,
  // что пункт приехал со вчера.
  it('показывает, что пункт перенесён со вчера', () => {
    render(
      <DayPlanItem
        plan={plan({ carriedFromId: 7 })}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('со вчера')).toBeInTheDocument();
  });

  it('у непереносённого пункта пометки нет', () => {
    render(<DayPlanItem plan={plan()} onToggle={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.queryByText('со вчера')).not.toBeInTheDocument();
  });

  // Правка текста — не одно нажатие, и для неё правило дизайна применяется:
  // она идёт в выезжающей панели.
  it('правка открывается кнопкой, а не вводом по месту', async () => {
    const onEdit = vi.fn();
    render(<DayPlanItem plan={plan()} onToggle={vi.fn()} onEdit={onEdit} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /правка/i }));

    expect(onEdit).toHaveBeenCalled();
  });

  it('галочка подписана текстом пункта', () => {
    render(<DayPlanItem plan={plan()} onToggle={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Написать план');
  });
});
