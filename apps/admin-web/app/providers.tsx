'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import React from 'react';
import { NoSSR } from '@/components/NoSSR';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

// Create QueryClient factory that works in both SSR and client
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        // Disable refetching during SSR/prerender
        refetchOnMount: typeof window !== 'undefined',
        refetchOnReconnect: typeof window !== 'undefined',
      },
    },
  });
}

// Browser-side singleton (reused across client-side renders)
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server-side: always return a new instance (safe for static export)
    return makeQueryClient();
  }
  // Client-side: reuse singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Always create QueryClient (works in both SSR and client)
  // This ensures QueryClientProvider is always available, even during static generation
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        {children}
        {/* Use NoSSR to prevent hydration mismatch with Toaster */}
        {/* Toaster uses client-side features (DOM manipulation) that can cause hydration issues */}
        <NoSSR>
          <Toaster position="top-right" />
        </NoSSR>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}

