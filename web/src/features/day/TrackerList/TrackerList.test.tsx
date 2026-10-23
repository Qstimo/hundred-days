import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrackerList } from './TrackerList';
import type { DayTracker } from '../hooks';

vi.mock('@/api-client', () => ({ apiClient: { PUT: vi.fn(), DELETE: vi.fn() } }));

function tracker(id: number, title: string): DayTracker {
  return {
    tracker: {
      id,
      title,
      mode: 'check',
      pointsRule: 'per_check',
      pointsValue: 1,
      weeklyTarget: 3,
      sortOrder: 0,
      archived: false,
      entryCount: 0,
    },
    entry: null,
    weekDone: 0,
    weekTarget: 3,
  };
}

function renderList(items: DayTracker[], isEditable = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TrackerList items={items} date="2026-10-23" isEditable={isEditable} />
    </QueryClientProvider>,
  );
}

describe('TrackerList', () => {
  it('показывает все трекеры', () => {
    renderList([tracker(1, 'Занятие'), tracker(2, 'Чтение')]);

    expect(screen.getByText('Занятие')).toBeInTheDocument();
    expect(screen.getByText('Чтение')).toBeInTheDocument();
  });

  it('пустой список приглашает завести трекер', () => {
    renderList([]);

    expect(screen.getByText(/пока нет трекеров/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /завести/i })).toHaveAttribute(
      'href',
      '/trackers',
    );
  });

  it('заголовок блока называет его', () => {
    renderList([tracker(1, 'Занятие')]);

    expect(screen.getByRole('heading', { name: 'Трекеры' })).toBeInTheDocument();
  });
});
