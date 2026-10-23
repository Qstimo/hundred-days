import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackerRow } from './TrackerRow';
import type { DayTracker } from '../hooks';

function item(overrides: Partial<DayTracker> = {}): DayTracker {
  return {
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
    ...overrides,
  };
}

function setup(overrides: Partial<Parameters<typeof TrackerRow>[0]> = {}) {
  const props = {
    item: item(),
    isEditable: true,
    onToggle: vi.fn(),
    onHoursChange: vi.fn(),
    ...overrides,
  };
  render(<TrackerRow {...props} />);
  return props;
}

describe('TrackerRow', () => {
  it('показывает название и недельный счёт', () => {
    setup();

    expect(screen.getByText('Занятие')).toBeInTheDocument();
    expect(screen.getByText('2 из 3 на этой неделе')).toBeInTheDocument();
  });

  it('у трекера без часов поля часов нет', () => {
    setup();

    expect(screen.queryByLabelText(/часы/i)).not.toBeInTheDocument();
  });

  it('у трекера с часами поле часов есть', () => {
    setup({
      item: item({
        tracker: { ...item().tracker, mode: 'check_hours', pointsRule: 'per_hour' },
      }),
    });

    expect(screen.getByLabelText(/часы/i)).toBeInTheDocument();
  });

  it('отмечает выполнение по нажатию на галочку', async () => {
    const props = setup();

    await userEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).toHaveBeenCalledWith(null, true);
  });

  it('снимает отметку повторным нажатием', async () => {
    const props = setup({
      item: item({ entry: { date: '2026-10-23', pointsAwarded: 1 } }),
    });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).toHaveBeenCalledWith(null, false);
  });

  it('у выполненного показывает начисленные поинты', () => {
    setup({ item: item({ entry: { date: '2026-10-23', pointsAwarded: 3 } }) });

    expect(screen.getByText(/3 поинта/)).toBeInTheDocument();
  });

  it('склоняет поинты', () => {
    setup({ item: item({ entry: { date: '2026-10-23', pointsAwarded: 1 } }) });

    // Без \b: в JavaScript граница слова считается по ASCII и после
    // кириллической «т» не срабатывает. Проверяется отсутствие окончаний.
    expect(screen.getByText(/1 поинт(?!а|ов)/)).toBeInTheDocument();
  });

  // У трекера «за час» отметка без часов начислит ноль — это почти наверняка
  // ошибка, и сервер её отвергает. Форма не должна давать такое отправить.
  it('не отправляет отметку «за час» без введённых часов', async () => {
    const props = setup({
      item: item({
        tracker: { ...item().tracker, mode: 'check_hours', pointsRule: 'per_hour' },
      }),
    });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/укажите часы/i);
  });

  it('с введёнными часами отметка «за час» отправляется', async () => {
    const props = setup({
      item: item({
        tracker: { ...item().tracker, mode: 'check_hours', pointsRule: 'per_hour' },
      }),
    });

    await userEvent.type(screen.getByLabelText(/часы/i), '1.5');
    await userEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).toHaveBeenCalledWith(1.5, true);
  });

  it('у трекера «за чек» с часами отметка без часов проходит', async () => {
    const props = setup({
      item: item({
        tracker: { ...item().tracker, mode: 'check_hours', pointsRule: 'per_check' },
      }),
    });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(props.onToggle).toHaveBeenCalledWith(null, true);
  });

  // Проверяется поведение, а не атрибут: галочка Radix отдаёт
  // aria-disabled, и совпадение атрибута ещё не значит, что нажатие не
  // проходит.
  it('в недоступном для правки дне нажатие ничего не делает', async () => {
    const props = setup({ isEditable: false });

    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(box);

    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it('галочка подписана названием трекера', () => {
    setup();

    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Занятие');
  });
});
