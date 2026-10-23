/** Разделы приложения. Порядок — по частоте захода. */
export const NAV_ITEMS = [
  { href: '/', label: 'День' },
  { href: '/trackers', label: 'Занятия' },
  { href: '/dashboard', label: 'Статистика' },
  { href: '/settings', label: 'Настройки' },
] as const;
