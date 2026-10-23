import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const pathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({ usePathname: () => pathname() }));

import { AppNav } from './AppNav';

describe('AppNav', () => {
  it('ведёт во все разделы', () => {
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'День' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Занятия' })).toHaveAttribute(
      'href',
      '/trackers',
    );
    expect(screen.getByRole('link', { name: 'Статистика' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Настройки' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  // Цвет не должен быть единственным признаком текущего раздела.
  it('помечает текущий раздел для чтения с экрана', () => {
    pathname.mockReturnValue('/trackers');
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Занятия' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'День' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  // Иначе «День» подсвечивался бы на каждой странице: все пути начинаются
  // с косой черты.
  it('день помечается только на самом дне', () => {
    pathname.mockReturnValue('/dashboard');
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'День' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Статистика' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('подраздел помечает свой раздел', () => {
    pathname.mockReturnValue('/settings/anything');
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Настройки' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
