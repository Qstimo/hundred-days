import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('отправляет логин и пароль', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(onSubmit).toHaveBeenCalledWith({
      login: 'vadim',
      password: 'длинный-пароль',
    });
  });

  it('не отправляет пустую форму', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('не отправляет форму с одним заполненным полем', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('показывает ошибку, не раскрывая, что именно не подошло', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('401'));
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'мимо');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Логин или пароль не подходят',
    );
  });

  it('блокирует кнопку на время отправки', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(screen.getByRole('button', { name: /Вхожу/ })).toBeDisabled();
    release();
  });

  it('убирает прежнюю ошибку при повторной попытке', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValueOnce(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'мимо');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Пароль'));
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('поле пароля скрывает ввод', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Пароль')).toHaveAttribute('type', 'password');
  });
});
