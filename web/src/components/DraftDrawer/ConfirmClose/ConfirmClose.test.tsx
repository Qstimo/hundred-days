import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmClose } from './ConfirmClose';

describe('ConfirmClose', () => {
  it('закрытый не показывает ничего', () => {
    render(<ConfirmClose isOpen={false} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('называет цену решения, а не спрашивает «вы уверены»', () => {
    render(<ConfirmClose isOpen onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      /несохранённые изменения.*потерять/i,
    );
  });

  it('отдаёт решение закрыть', async () => {
    const onDiscard = vi.fn();
    render(<ConfirmClose isOpen onDiscard={onDiscard} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть без сохранения' }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('отдаёт решение вернуться', async () => {
    const onCancel = vi.fn();
    render(<ConfirmClose isOpen onDiscard={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Вернуться к правке' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
