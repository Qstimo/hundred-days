import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './RegisterForm';

describe('RegisterForm', () => {
  it('отправляет логин, имя и пароль', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Имя'), 'Вадим');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(onSubmit).toHaveBeenCalledWith({
      login: 'vadim',
      name: 'Вадим',
      password: 'длинный-пароль',
    });
  });

  it('имя не обязательно', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: '' }),
    );
  });

  it('не отправляет пустую форму', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('короткий пароль отправить не даёт', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), '1234567');

    expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
    expect(screen.getByText(/Не короче 8 знаков/)).toHaveClass('text-destructive');
  });

  // Восемь русских букв — шестнадцать байт. Проверка по длине строки в
  // байтах пропустила бы пароль из четырёх букв.
  it('длина пароля считается в знаках, а не в байтах', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'паролик');

    expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Пароль'), 'и');

    expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeEnabled();
  });

  it('пароль скрыт при вводе', () => {
    render(<RegisterForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Пароль')).toHaveAttribute('type', 'password');
  });

  it('показывает отказ от сервера', () => {
    render(<RegisterForm onSubmit={vi.fn()} error="Такой логин занят" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Такой логин занят');
  });

  it('блокирует кнопку на время отправки', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((r) => { release = r; }));
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(screen.getByRole('button', { name: /Создаю/ })).toBeDisabled();
    release();
  });

  it('обрезает пробелы в логине и имени', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Логин'), '  vadim  ');
    await userEvent.type(screen.getByLabelText('Имя'), '  Вадим  ');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ login: 'vadim', name: 'Вадим' }),
    );
  });
});
