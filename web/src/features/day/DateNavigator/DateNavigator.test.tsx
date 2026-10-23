import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import { DateNavigator } from './DateNavigator';

describe('DateNavigator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('называет открытый день', () => {
    render(<DateNavigator date="2026-10-21" today="2026-10-23" />);

    expect(screen.getByText('21 октября, среда')).toBeInTheDocument();
  });

  it('сегодняшний день называет словом', () => {
    render(<DateNavigator date="2026-10-23" today="2026-10-23" />);

    expect(screen.getByText('Сегодня, 23 октября')).toBeInTheDocument();
  });

  it('уходит на день назад', async () => {
    render(<DateNavigator date="2026-10-23" today="2026-10-23" />);

    await userEvent.click(screen.getByRole('button', { name: 'Предыдущий день' }));

    expect(push).toHaveBeenCalledWith('/?date=2026-10-22');
  });

  it('уходит на день вперёд', async () => {
    render(<DateNavigator date="2026-10-21" today="2026-10-23" />);

    await userEvent.click(screen.getByRole('button', { name: 'Следующий день' }));

    expect(push).toHaveBeenCalledWith('/?date=2026-10-22');
  });

  // Будущую дату отметить нельзя, и давать по ней ходить незачем.
  it('на сегодняшнем дне кнопка вперёд выключена', () => {
    render(<DateNavigator date="2026-10-23" today="2026-10-23" />);

    expect(screen.getByRole('button', { name: 'Следующий день' })).toBeDisabled();
  });

  it('кнопка назад доступна всегда: прошлое открыто для правки', () => {
    render(<DateNavigator date="2020-01-01" today="2026-10-23" />);

    expect(screen.getByRole('button', { name: 'Предыдущий день' })).toBeEnabled();
  });

  it('возврат к сегодня показывается только не на сегодня', async () => {
    const { unmount } = render(<DateNavigator date="2026-10-23" today="2026-10-23" />);
    expect(screen.queryByRole('button', { name: 'Сегодня' })).not.toBeInTheDocument();
    unmount();

    render(<DateNavigator date="2026-10-21" today="2026-10-23" />);
    await userEvent.click(screen.getByRole('button', { name: 'Сегодня' }));

    // Без параметра: сегодня определяет сервер, а не клиент.
    expect(push).toHaveBeenCalledWith('/');
  });
});
