import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftDrawer } from './DraftDrawer';

function setup(overrides: Partial<Parameters<typeof DraftDrawer>[0]> = {}) {
  const props = {
    isOpen: true,
    title: 'Трекер',
    isDirty: false,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    children: <input aria-label="Название" />,
    ...overrides,
  };
  render(<DraftDrawer {...props} />);
  return props;
}

describe('DraftDrawer', () => {
  it('показывает заголовок и кнопку сохранения', () => {
    setup();

    expect(screen.getByText('Трекер')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
  });

  it('блокирует «Сохранить», пока нет изменений', () => {
    setup({ isDirty: false });

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('разрешает «Сохранить» при изменениях', () => {
    setup({ isDirty: true });

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('закрывается без вопросов, когда изменений нет', async () => {
    const props = setup({ isDirty: false });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(props.onClose).toHaveBeenCalled();
    expect(screen.queryByText(/несохранённые/i)).not.toBeInTheDocument();
  });

  it('спрашивает подтверждение при закрытии с несохранёнными изменениями', async () => {
    const props = setup({ isDirty: true });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(screen.getByText(/несохранённые изменения/i)).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('подтверждённое закрытие теряет правку', async () => {
    const props = setup({ isDirty: true });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть без сохранения' }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it('отказ от закрытия оставляет панель открытой', async () => {
    const props = setup({ isDirty: true });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    await userEvent.click(screen.getByRole('button', { name: 'Вернуться к правке' }));

    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
  });

  it('закрывается после удачного сохранения', async () => {
    const props = setup({ isDirty: true });

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onSave).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('оставляет панель открытой, если сохранение не удалось', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('не вышло'));
    const props = setup({ isDirty: true, onSave });

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('блокирует кнопку на время сохранения', async () => {
    let release: () => void = () => {};
    const onSave = vi.fn(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    setup({ isDirty: true, onSave });

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('button', { name: /Сохраняю/ })).toBeDisabled();
    release();
  });

  it('закрытая панель содержимого не показывает', () => {
    setup({ isOpen: false });

    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
  });
});
