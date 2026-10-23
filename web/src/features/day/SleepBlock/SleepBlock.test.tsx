import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SleepBlock } from './SleepBlock';
import type { Sleep } from '../hooks';

const PUT = vi.fn().mockResolvedValue({ data: {} });
vi.mock('@/api-client', () => ({
  apiClient: { PUT: (...a: unknown[]) => PUT(...a) },
}));

function renderBlock(sleep: Sleep | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SleepBlock sleep={sleep} date="2026-10-23" />
    </QueryClientProvider>,
  );
}

describe('SleepBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('показывает поля «лёг», «встал» и оценку', () => {
    renderBlock(null);

    expect(screen.getByLabelText('Лёг')).toBeInTheDocument();
    expect(screen.getByLabelText('Встал')).toBeInTheDocument();
    expect(screen.getByLabelText('Качество сна')).toBeInTheDocument();
  });

  it('поля времени — браузерные, с собственной клавиатурой', () => {
    renderBlock(null);

    expect(screen.getByLabelText('Лёг')).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText('Встал')).toHaveAttribute('type', 'time');
  });

  it('показывает заполненные значения', () => {
    renderBlock({
      date: '2026-10-23',
      wentToBedAt: '23:40',
      wokeUpAt: '07:10',
      quality: 4,
      durationMinutes: 450,
    });

    expect(screen.getByLabelText('Лёг')).toHaveValue('23:40');
    expect(screen.getByLabelText('Встал')).toHaveValue('07:10');
  });

  // Длительность берётся из ответа сервера: правило перехода через полночь
  // живёт там, и повторять его на клиенте значило бы завести второе место,
  // где оно может разойтись.
  it('показывает длительность, посчитанную сервером', () => {
    renderBlock({
      date: '2026-10-23',
      wentToBedAt: '23:40',
      wokeUpAt: '07:10',
      durationMinutes: 450,
    });

    expect(screen.getByText(/7 ч 30 мин/)).toBeInTheDocument();
  });

  it('не показывает длительность, когда заполнено одно время', () => {
    renderBlock({ date: '2026-10-23', wokeUpAt: '07:00', durationMinutes: null });

    expect(screen.queryByText(/ч .* мин/)).not.toBeInTheDocument();
  });

  it('сохраняет по уходу фокуса, а не по каждой цифре', async () => {
    renderBlock(null);

    const field = screen.getByLabelText('Лёг');
    await userEvent.type(field, '23:40');
    expect(PUT).not.toHaveBeenCalled();

    await userEvent.tab();

    expect(PUT).toHaveBeenCalledWith('/sleep/{date}', {
      params: { path: { date: '2026-10-23' } },
      body: { wentToBedAt: '23:40', wokeUpAt: null, quality: null },
    });
  });

  it('пустое время уходит как отсутствие значения', async () => {
    renderBlock({
      date: '2026-10-23',
      wentToBedAt: '23:40',
      wokeUpAt: '07:10',
      durationMinutes: 450,
    });

    await userEvent.clear(screen.getByLabelText('Лёг'));
    await userEvent.tab();

    expect(PUT).toHaveBeenCalledWith('/sleep/{date}', {
      params: { path: { date: '2026-10-23' } },
      body: { wentToBedAt: null, wokeUpAt: '07:10', quality: null },
    });
  });
});
