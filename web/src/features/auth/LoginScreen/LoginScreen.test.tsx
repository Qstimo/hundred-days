import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

const login = vi.fn();
vi.mock('../utils', () => ({
  login: (...args: unknown[]) => login(...args),
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillAndSubmit() {
    await userEvent.type(screen.getByLabelText('Логин'), 'vadim');
    await userEvent.type(screen.getByLabelText('Пароль'), 'длинный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  }

  it('уводит на главную после входа', async () => {
    login.mockResolvedValue(undefined);
    render(<LoginScreen />);

    await fillAndSubmit();

    expect(login).toHaveBeenCalledWith({ login: 'vadim', password: 'длинный-пароль' });
    // replace, а не push: страница входа не должна оставаться в истории.
    expect(replace).toHaveBeenCalledWith('/');
    // refresh: серверные компоненты держат свой снимок сессии.
    expect(refresh).toHaveBeenCalled();
  });

  it('при отказе остаётся на месте и показывает ошибку', async () => {
    login.mockRejectedValue(new Error('вход не удался'));
    render(<LoginScreen />);

    await fillAndSubmit();

    expect(replace).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Логин или пароль не подходят',
    );
  });
});
