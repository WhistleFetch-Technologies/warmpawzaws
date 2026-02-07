'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, lazy, Suspense } from 'react';
import { SearchContextProvider } from '@/context/SearchContext';
import { CartProvider } from '@/context/CartContext';

// Lazy load DevTools - only imported in development mode
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  }))
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            // Performance optimization: Reduce retries for faster feedback
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <SearchContextProvider>
          {children}
          <Toaster position="top-right" />
          {/* Only load DevTools in development mode - prevents bundle bloat in production */}
          {process.env.NODE_ENV === 'development' && (
            <Suspense fallback={null}>
              <ReactQueryDevtools initialIsOpen={false} />
            </Suspense>
          )}
        </SearchContextProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

