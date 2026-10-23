import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DayPlanList } from './DayPlanList';
import type { DayPlan } from '../hooks';

const POST = vi.fn().mockResolvedValue({ data: {} });
const PATCH = vi.fn().mockResolvedValue({ data: {} });
const DELETE = vi.fn().mockResolvedValue({ data: {} });
vi.mock('@/api-client', () => ({
  apiClient: {
    POST: (...a: unknown[]) => POST(...a),
    PATCH: (...a: unknown[]) => PATCH(...a),
    DELETE: (...a: unknown[]) => DELETE(...a),
  },
}));

function plan(id: number, title: string, done = false): DayPlan {
  return { id, date: '2026-10-23', title, done, sortOrder: 0 };
}

function renderList(plans: DayPlan[], carryOverAvailable = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DayPlanList plans={plans} date="2026-10-23" carryOverAvailable={carryOverAvailable} />
    </QueryClientProvider>,
  );
}

describe('DayPlanList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('показывает пункты', () => {
    renderList([plan(1, 'Первое'), plan(2, 'Второе')]);

    expect(screen.getByText('Первое')).toBeInTheDocument();
    expect(screen.getByText('Второе')).toBeInTheDocument();
  });

  it('добавляет пункт по нажатию Enter', async () => {
    renderList([]);

    await userEvent.type(screen.getByLabelText(/новый пункт/i), 'Купить хлеб{Enter}');

    expect(POST).toHaveBeenCalledWith('/day-plans', {
      body: { date: '2026-10-23', title: 'Купить хлеб' },
    });
  });

  it('добавляет пункт кнопкой', async () => {
    renderList([]);

    await userEvent.type(screen.getByLabelText(/новый пункт/i), 'Купить хлеб');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(POST).toHaveBeenCalledWith('/day-plans', {
      body: { date: '2026-10-23', title: 'Купить хлеб' },
    });
  });

  it('кнопка выключена, пока поле пусто', async () => {
    renderList([]);

    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/новый пункт/i), 'Что-то');

    expect(screen.getByRole('button', { name: 'Добавить' })).toBeEnabled();
  });

  it('не добавляет пустой пункт', async () => {
    renderList([]);

    await userEvent.type(screen.getByLabelText(/новый пункт/i), '   {Enter}');

    expect(POST).not.toHaveBeenCalled();
  });

  it('очищает поле после добавления', async () => {
    renderList([]);

    const field = screen.getByLabelText(/новый пункт/i);
    await userEvent.type(field, 'Купить хлеб{Enter}');

    expect(field).toHaveValue('');
  });

  it('закрывает пункт галочкой', async () => {
    renderList([plan(1, 'Первое')]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Первое' }));

    expect(PATCH).toHaveBeenCalledWith('/day-plans/{id}', {
      params: { path: { id: 1 } },
      body: { done: true },
    });
  });

  it('показывает кнопку переноса, когда со вчера есть незакрытые', () => {
    renderList([], true);

    expect(
      screen.getByRole('button', { name: /подтянуть незакрытые со вчера/i }),
    ).toBeInTheDocument();
  });

  it('скрывает кнопку переноса, когда переносить нечего', () => {
    renderList([], false);

    expect(screen.queryByRole('button', { name: /подтянуть/i })).not.toBeInTheDocument();
  });

  it('переносит незакрытые со вчера', async () => {
    renderList([], true);

    await userEvent.click(
      screen.getByRole('button', { name: /подтянуть незакрытые со вчера/i }),
    );

    expect(POST).toHaveBeenCalledWith('/day-plans/carry-over', {
      body: { date: '2026-10-23' },
    });
  });

  it('пустой список говорит, что планов нет', () => {
    renderList([]);

    expect(screen.getByText(/планов на этот день нет/i)).toBeInTheDocument();
  });

  it('правка пункта открывает панель', async () => {
    renderList([plan(1, 'Первое')]);

    await userEvent.click(screen.getByRole('button', { name: /правка пункта/i }));

    expect(screen.getByRole('complementary', { name: /пункт плана/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Текст пункта')).toHaveValue('Первое');
  });

  it('сохранение правки отправляет новый текст', async () => {
    renderList([plan(1, 'Первое')]);

    await userEvent.click(screen.getByRole('button', { name: /правка пункта/i }));
    const field = screen.getByLabelText('Текст пункта');
    await userEvent.clear(field);
    await userEvent.type(field, 'Исправленное');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(PATCH).toHaveBeenCalledWith('/day-plans/{id}', {
      params: { path: { id: 1 } },
      body: { title: 'Исправленное' },
    });
  });

  it('удаление пункта идёт из панели', async () => {
    renderList([plan(1, 'Первое')]);

    await userEvent.click(screen.getByRole('button', { name: /правка пункта/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(DELETE).toHaveBeenCalledWith('/day-plans/{id}', {
      params: { path: { id: 1 } },
    });
  });
});
