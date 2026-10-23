import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppNav } from '@/components/AppNav';
import { Providers } from './providers';
import './globals.css';

/**
 * Inter — интерфейсный шрифт с высокой разборчивостью в мелких кеглях и
 * ровной шириной цифр в табличном начертании. Системный стек остаётся
 * запасным: если шрифт не доехал, текст не должен поехать вместе с ним.
 *
 * display: swap — текст показывается системным шрифтом сразу, не дожидаясь
 * загрузки: пустая страница хуже неидеального шрифта.
 */
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: '100 дней до',
  description: 'Личный трекер с ограниченным сроком',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <Providers>
          <AppNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
