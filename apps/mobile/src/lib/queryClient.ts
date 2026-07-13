import { QueryClient } from '@tanstack/react-query';

const onQueryError = (error: unknown) => {
  if (__DEV__) {
    console.warn('[TanStack Query] Query error:', error);
  }
  // In production: errors are handled per-query via isError/error state.
  // A global toast/snackbar can be wired here when the notification system is ready.
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // Data stays fresh for 30 seconds
      gcTime: 10 * 60_000,     // Cache kept for 10 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Global error handler — fires for every failed query
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    onQueryError(event.query.state.error);
  }
});

// Global error handler — fires for every failed mutation
queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'updated' && event.mutation?.state.status === 'error') {
    onQueryError(event.mutation.state.error);
  }
});
