'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Провайдер запросов.
 *
 * Клиент создаётся через useState, а не в области модуля: иначе он был бы
 * общим на весь процесс сервера, и данные одного человека утекли бы другому.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Данные меняются только от собственных действий: перезапрос при
            // возврате в окно ни к чему.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
