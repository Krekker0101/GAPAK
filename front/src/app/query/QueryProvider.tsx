import React, { PropsWithChildren, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../shared/api/httpClient';

const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
};

const retryDelay = (attemptIndex: number): number => {
  const base = Math.min(4_000, 250 * 2 ** attemptIndex);
  return base + Math.floor(Math.random() * Math.min(250, base * 0.25));
};

export const QueryProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        retryDelay,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
