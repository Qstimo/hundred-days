import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDrawer } from './SettingsDrawer';
import type { Settings } from '../hooks';

const settings: Settings = {
  periodTitle: '100 дней до',
  periodStart: '2026-10-01',
  periodDays: 100,
  sleepEnabled: true,
};

function setup(overrides: Partial<Parameters<typeof SettingsDrawer>[0]> = {}) {
  const props = {
    settings,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SettingsDrawer {...props} />);
  return props;
}

describe('SettingsDrawer', () => {
  it('закрытая панель не рисуется', () => {
    setup({ settings: undefined });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('показывает текущие настройки', () => {
    setup();

    expect(screen.getByLabelText('Заголовок')).toHaveValue('100 дней до');
    expect(screen.getByLabelText('Дата начала')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Длительность в днях')).toHaveValue(100);
    expect(screen.getByLabelText(/показывать блок сна/i)).toBeChecked();
  });

  // «Сто дней от 1 октября» — не та информация, которую держат в голове.
  it('подсказывает, какой датой кончится период', () => {
    setup();

    expect(screen.getByText(/Кончится 8 января/)).toBeInTheDocument();
  });

  it('пересчитывает дату окончания при смене длительности', async () => {
    setup();

    const days = screen.getByLabelText('Длительность в днях');
    await userEvent.clear(days);
    await userEvent.type(days, '30');

    expect(screen.getByText(/Кончится 30 октября/)).toBeInTheDocument();
  });

  it('предупреждает, что смена даты начала сдвинет номер дня', async () => {
    setup();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const start = screen.getByLabelText('Дата начала');
    await userEvent.clear(start);
    await userEvent.type(start, '2026-11-01');

    expect(screen.getByRole('alert')).toHaveTextContent(/сдвинет номер/i);
  });

  it('сохраняет новые значения', async () => {
    const props = setup();

    const days = screen.getByLabelText('Длительность в днях');
    await userEvent.clear(days);
    await userEvent.type(days, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith({
      periodTitle: '100 дней до',
      periodStart: '2026-10-01',
      periodDays: 60,
      sleepEnabled: true,
    });
  });

  it('переключает тумблер сна', async () => {
    const props = setup();

    await userEvent.click(screen.getByLabelText(/показывать блок сна/i));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sleepEnabled: false }),
    );
  });

  it('длительность вне предела сохранить не даёт', async () => {
    setup();

    const days = screen.getByLabelText('Длительность в днях');
    await userEvent.clear(days);
    await userEvent.type(days, '4000');

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('пустой заголовок сохранить не даёт', async () => {
    setup();

    await userEvent.clear(screen.getByLabelText('Заголовок'));

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('блокирует «Сохранить», пока ничего не изменено', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });
});
