'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';
import { GlobalClientErrorReporting } from '@/components/GlobalClientErrorReporting';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ClientErrorBoundary>
        <GlobalClientErrorReporting />
        <ScrollToTop />
        <div className="h-full min-h-0">{children}</div>
        <Toaster position="top-right" />
      </ClientErrorBoundary>
    </QueryClientProvider>
  );
}

