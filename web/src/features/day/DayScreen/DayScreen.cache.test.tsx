import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DayScreen } from './DayScreen';
import type { DayResponse } from '../hooks';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const GET = vi.fn();
const PUT = vi.fn(() => Promise.resolve({ data: {} }));
const POST = vi.fn(() => Promise.resolve({ data: {} }));
const DELETE = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock('@/api-client', () => ({
  apiClient: {
    GET: (...a: unknown[]) => GET(...a),
    PUT: (...a: unknown[]) => PUT(...a),
    POST: (...a: unknown[]) => POST(...a),
    PATCH: vi.fn(),
    DELETE: (...a: unknown[]) => DELETE(...a),
  },
}));

function day(overrides: Partial<DayResponse> = {}): DayResponse {
  return {
    date: '2026-10-23',
    period: {
      title: '100 дней до',
      start: '2026-10-01',
      days: 100,
      today: '2026-10-23',
      dayNumber: 23,
      daysLeft: 78,
    },
    sleepEnabled: false,
    trackers: [
      {
        tracker: {
          id: 1,
          title: 'Занятие',
          mode: 'check',
          pointsRule: 'per_check',
          pointsValue: 1,
          weeklyTarget: 3,
          sortOrder: 0,
          archived: false,
          entryCount: 0,
        },
        entry: null,
        weekDone: 1,
        weekTarget: 3,
      },
    ],
    plans: [],
    carryOverAvailable: false,
    skills: [],
    ...overrides,
  };
}

/**
 * Главная открывается без параметра даты — ровно так, как ею пользуются
 * каждый день. Экран и мутации обязаны работать с одной записью кэша.
 *
 * Пока они расходились — экран читал ключ «today», а мутации писали под
 * разрешённую дату, — отметка уходила на сервер, но на экране не
 * закрашивалась, и добавленный пункт не появлялся до перезагрузки.
 *
 * staleTime бесконечен нарочно: при обычном нуле запрос перезапрашивается
 * сразу на монтировании, и подставленный ответ приехал бы раньше нажатия —
 * тогда тест проверял бы ответ сервера, а не согласие ключей.
 */
function renderDay(initial: DayResponse = day()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={client}>
      <DayScreen initialDay={initial} />
    </QueryClientProvider>,
  );
}

/** День с проставленной отметкой — то, чем сервер ответит после записи. */
function dayWithEntry(): DayResponse {
  return day({
    trackers: [
      {
        ...day().trackers[0],
        entry: { date: '2026-10-23', pointsAwarded: 1 },
        weekDone: 2,
      },
    ],
  });
}

describe('DayScreen без параметра даты', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    GET.mockResolvedValue({ data: day() });
  });

  it('отметка закрашивается сразу, не дожидаясь ответа', async () => {
    renderDay();
    // После записи сервер отвечает днём с отметкой: перезапрос не должен
    // затирать то, что только что произошло.
    GET.mockResolvedValue({ data: dayWithEntry() });

    const box = screen.getByRole('checkbox', { name: 'Занятие' });
    expect(box).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(box);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Занятие' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    // Запрос уходит позже, чем красится галочка: оптимистичное обновление
    // происходит в onMutate, до вызова mutationFn.
    await waitFor(() => expect(PUT).toHaveBeenCalled());
    expect(DELETE).not.toHaveBeenCalled();
  });

  it('недельный счёт растёт сразу', async () => {
    renderDay();
    GET.mockResolvedValue({ data: dayWithEntry() });

    expect(screen.getByText(/1 из 3 на этой неделе/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Занятие' }));

    // Выражением, а не точной строкой: после отметки к той же строке
    // дописываются начисленные поинты.
    await waitFor(() => {
      expect(screen.getByText(/2 из 3 на этой неделе/)).toBeInTheDocument();
    });
  });

  it('снятая отметка исчезает сразу', async () => {
    renderDay(dayWithEntry());
    // После снятия сервер отвечает днём без отметки.
    GET.mockResolvedValue({ data: day() });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Занятие' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Занятие' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });
    await waitFor(() => expect(DELETE).toHaveBeenCalled());
    expect(PUT).not.toHaveBeenCalled();
  });

  it('добавленный пункт появляется в списке', async () => {
    renderDay();

    // Перезапрос после записи вернёт день с новым пунктом.
    GET.mockResolvedValue({
      data: day({
        plans: [
          { id: 1, date: '2026-10-23', title: 'Купить хлеб', done: false, sortOrder: 0 },
        ],
      }),
    });

    await userEvent.type(screen.getByLabelText(/новый пункт/i), 'Купить хлеб{Enter}');

    expect(POST).toHaveBeenCalledWith('/day-plans', {
      body: { date: '2026-10-23', title: 'Купить хлеб' },
    });
    await waitFor(() => {
      expect(screen.getByText('Купить хлеб')).toBeInTheDocument();
    });
  });

  it('запрос дня идёт по разрешённой дате, а не без параметра', async () => {
    renderDay();
    GET.mockResolvedValue({ data: dayWithEntry() });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Занятие' }));

    // Перезапрос после записи обязан спрашивать тот же день.
    await waitFor(() => expect(GET).toHaveBeenCalled());
    expect(GET).toHaveBeenCalledWith('/day', {
      params: { query: { date: '2026-10-23' } },
    });
  });
});
