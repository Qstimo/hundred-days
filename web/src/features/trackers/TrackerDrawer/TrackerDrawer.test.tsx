import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackerDrawer } from './TrackerDrawer';
import type { Skill, Tracker } from '../hooks';

const skills: Skill[] = [
  { id: 7, title: 'Английский', targetPoints: 300, unitLabel: '', sortOrder: 0, archived: false },
  { id: 8, title: 'Гитара', targetPoints: 100, unitLabel: '', sortOrder: 1, archived: false },
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

function setup(overrides: Partial<Parameters<typeof TrackerDrawer>[0]> = {}) {
  const props = {
    tracker: tracker(),
    skills,
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TrackerDrawer {...props} />);
  return props;
}

describe('TrackerDrawer', () => {
  it('закрытая панель не рисуется', () => {
    setup({ tracker: undefined });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('создание называется новым трекером', () => {
    setup({ tracker: null, onDelete: undefined });

    expect(screen.getByRole('complementary', { name: 'Новый трекер' })).toBeInTheDocument();
  });

  it('правка показывает текущие значения', () => {
    setup();

    expect(screen.getByLabelText('Название')).toHaveValue('Занятие');
    expect(screen.getByLabelText('Раз в неделю')).toHaveValue('3');
    expect(screen.getByLabelText('Навык')).toHaveValue('7');
  });

  it('блокирует «Сохранить», пока ничего не изменено', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('собирает поля в черновик и отправляет одной кнопкой', async () => {
    const props = setup();

    await userEvent.clear(screen.getByLabelText('Название'));
    await userEvent.type(screen.getByLabelText('Название'), 'Чтение');
    await userEvent.selectOptions(screen.getByLabelText('Раз в неделю'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith({
      title: 'Чтение',
      mode: 'check',
      pointsRule: 'per_check',
      pointsValue: 1,
      skillId: 7,
      weeklyTarget: 5,
    });
  });

  // Сочетание «за час» без часов сервер отвергает. Форма не должна его
  // предлагать вовсе.
  it('скрывает правило «за час» у режима без часов', () => {
    setup({ tracker: tracker({ mode: 'check' }) });

    const options = screen
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter(Boolean);

    expect(options).not.toContain('За час');
  });

  it('показывает правило «за час» у режима с часами', async () => {
    setup({ tracker: tracker({ mode: 'check_hours' }) });

    expect(screen.getByLabelText('Поинты начисляются')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Поинты начисляются'), 'per_hour');
    expect(screen.getByLabelText('Поинты начисляются')).toHaveValue('per_hour');
  });

  it('сбрасывает правило на «за выполнение» при смене режима на «без часов»', async () => {
    const props = setup({
      tracker: tracker({ mode: 'check_hours', pointsRule: 'per_hour' }),
    });

    await userEvent.selectOptions(screen.getByLabelText('Что отмечается'), 'check');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'check', pointsRule: 'per_check' }),
    );
  });

  it('позволяет не привязывать навык', async () => {
    const props = setup();

    await userEvent.selectOptions(screen.getByLabelText('Навык'), '');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: null }),
    );
  });

  it('предлагает только переданные навыки', () => {
    setup();

    const labels = screen
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter(Boolean);

    expect(labels).toContain('Английский');
    expect(labels).toContain('Гитара');
    expect(labels).toContain('Без навыка');
  });

  // Удаление, молча уносящее историю, однажды окажется неожиданностью.
  it('удаление называет, сколько отметок унесёт', async () => {
    setup({ tracker: tracker({ entryCount: 12 }) });

    await userEvent.click(screen.getByRole('button', { name: 'Удалить трекер' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('уйдут 12 отметок');
  });

  it('у трекера без отметок говорит, что их нет', async () => {
    setup({ tracker: tracker({ entryCount: 0 }) });

    await userEvent.click(screen.getByRole('button', { name: 'Удалить трекер' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Отметок у него пока нет');
  });

  it('удаляет только после подтверждения', async () => {
    const props = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить трекер' }));
    expect(props.onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('отказ от удаления ничего не делает', async () => {
    const props = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить трекер' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('у нового трекера кнопки удаления нет', () => {
    setup({ tracker: null, onDelete: undefined });

    expect(screen.queryByRole('button', { name: /удалить/i })).not.toBeInTheDocument();
  });

  it('спрашивает подтверждение при закрытии с несохранёнными изменениями', async () => {
    const props = setup();

    await userEvent.type(screen.getByLabelText('Название'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(screen.getByText(/несохранённые изменения/i)).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('пустое название сохранить не даёт', async () => {
    setup();

    await userEvent.clear(screen.getByLabelText('Название'));

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('недельную цель вне 1…7 выбрать нельзя', () => {
    setup();

    // Варианты берутся из самого поля цели: по всей панели попались бы и
    // идентификаторы навыков, которые к недельной цели отношения не имеют.
    const select = screen.getByLabelText('Раз в неделю') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => Number(o.value));

    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
