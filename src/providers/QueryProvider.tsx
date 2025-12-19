/**
 * React Query Provider
 * Centralized data fetching and caching with React Query
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // ✅ FIX: Create queryClient once using useState to prevent recreation on every render
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache configuration
        staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes (previously cacheTime)
        
        // Retry configuration
        retry: 1, // Retry failed requests once
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch configuration
        refetchOnWindowFocus: false, // Don't refetch on window focus (too aggressive)
        refetchOnReconnect: true, // Refetch when internet reconnects
        refetchOnMount: true, // Refetch on component mount if stale
        
        // Error handling
        throwOnError: false, // Don't throw errors (handle in components)
      },
      mutations: {
        // Retry configuration for mutations
        retry: 0, // Don't retry mutations (user actions should be explicit)
        
        // Error handling
        throwOnError: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      
      {/* Dev tools - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          position="bottom-right"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

export default QueryProvider;