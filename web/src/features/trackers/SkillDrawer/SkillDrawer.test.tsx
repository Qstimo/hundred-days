import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillDrawer } from './SkillDrawer';
import type { Skill, Tracker } from '../hooks';

const skill: Skill = {
  id: 7,
  title: 'Английский',
  targetPoints: 300,
  unitLabel: 'занятие',
  sortOrder: 0,
  archived: false,
};

function tracker(id: number, title: string): Tracker {
  return {
    id,
    title,
    mode: 'check',
    pointsRule: 'per_check',
    pointsValue: 1,
    skillId: 7,
    weeklyTarget: 3,
    sortOrder: 0,
    archived: false,
    entryCount: 5,
  };
}

function setup(overrides: Partial<Parameters<typeof SkillDrawer>[0]> = {}) {
  const props = {
    skill,
    feedingTrackers: [] as Tracker[],
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SkillDrawer {...props} />);
  return props;
}

describe('SkillDrawer', () => {
  it('закрытая панель не рисуется', () => {
    setup({ skill: undefined });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('правка показывает текущие значения', () => {
    setup();

    expect(screen.getByLabelText('Название')).toHaveValue('Английский');
    expect(screen.getByLabelText('Цель в поинтах')).toHaveValue('300');
    expect(screen.getByLabelText('Подпись единицы')).toHaveValue('занятие');
  });

  it('требует положительную цель', async () => {
    setup();

    const target = screen.getByLabelText('Цель в поинтах');
    await userEvent.clear(target);
    await userEvent.type(target, '0');

    expect(screen.getByRole('alert')).toHaveTextContent('больше нуля');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('сохраняет новые значения', async () => {
    const props = setup();

    const target = screen.getByLabelText('Цель в поинтах');
    await userEvent.clear(target);
    await userEvent.type(target, '500');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith({
      title: 'Английский',
      targetPoints: 500,
      unitLabel: 'занятие',
    });
  });

  it('принимает запятую в цели', async () => {
    const props = setup();

    const target = screen.getByLabelText('Цель в поинтах');
    await userEvent.clear(target);
    await userEvent.type(target, '2,5');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ targetPoints: 2.5 }),
    );
  });

  it('показывает, какие трекеры питают навык', () => {
    setup({ feedingTrackers: [tracker(1, 'Занятие'), tracker(2, 'Чтение')] });

    expect(screen.getByText(/Питают навык: Занятие, Чтение/)).toBeInTheDocument();
  });

  // Правда целиком: трекеры потеряют навык, но отметки и поинты в них
  // останутся — они зафиксированы в момент выполнения.
  it('предупреждает, что трекеры потеряют навык, а поинты останутся', async () => {
    setup({ feedingTrackers: [tracker(1, 'Занятие'), tracker(2, 'Чтение')] });

    await userEvent.click(screen.getByRole('button', { name: 'Удалить навык' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('2 трекера потеряют навык');
    expect(dialog).toHaveTextContent('отметки и поинты в них останутся');
  });

  it('у навыка без трекеров так и говорит', async () => {
    setup({ feedingTrackers: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Удалить навык' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Трекеров у него нет');
  });

  it('удаляет только после подтверждения', async () => {
    const props = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить навык' }));
    expect(props.onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('у нового навыка кнопки удаления нет', () => {
    setup({ skill: null, onDelete: undefined });

    expect(screen.queryByRole('button', { name: /удалить/i })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Новый навык' })).toBeInTheDocument();
  });

  it('новый навык получает цель по умолчанию', () => {
    setup({ skill: null, onDelete: undefined });

    expect(screen.getByLabelText('Цель в поинтах')).toHaveValue('100');
  });
});
