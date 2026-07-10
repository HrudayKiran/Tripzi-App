import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // Data stays fresh for 30 seconds
      gcTime: 10 * 60_000,     // Cache kept for 10 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});
