import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDelete } from './ConfirmDelete';

describe('ConfirmDelete', () => {
  it('закрытый не показывает ничего', () => {
    render(
      <ConfirmDelete
        isOpen={false}
        what="трекер"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('называет, что удаляется', () => {
    render(
      <ConfirmDelete
        isOpen
        what="трекер «Чтение»"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Удалить трекер «Чтение»?');
  });

  // Удаление, молча уносящее историю, однажды окажется неприятной
  // неожиданностью. Цену надо назвать до, а не после.
  it('называет, что будет унесено', () => {
    render(
      <ConfirmDelete
        isOpen
        what="трекер «Чтение»"
        consequence="Вместе с ним уйдут 12 отметок."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('уйдут 12 отметок');
  });

  it('отдаёт подтверждение', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDelete isOpen what="трекер" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('отдаёт отказ', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDelete isOpen what="трекер" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
