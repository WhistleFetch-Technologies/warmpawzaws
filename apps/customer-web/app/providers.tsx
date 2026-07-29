'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, lazy, Suspense } from 'react';
import { SearchContextProvider } from '@/context/SearchContext';
import { CartProvider } from '@/context/CartContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { AnalyticsRouteTracker } from '@/components/AnalyticsRouteTracker';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';
import { GlobalClientErrorReporting } from '@/components/GlobalClientErrorReporting';
import { PushSessionRegistrar } from '@/components/PushSessionRegistrar';
import { CapacitorVendorDeepLinkListener } from '@/components/CapacitorVendorDeepLinkListener';
import { VendorSharePathBootstrap } from '@/components/VendorSharePathBootstrap';
import { NavigationBackBridge } from '@/components/navigation/NavigationBackBridge';
import { StaticImagePrewarm } from '@/components/StaticImagePrewarm';
import { CommerceConfigProvider } from '@/lib/commerce-config-provider';

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
            // Catalog/subscription-style reads (hooks using React Query)
            staleTime: 5 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ClientErrorBoundary>
        <GlobalClientErrorReporting />
        <PushSessionRegistrar />
        <CapacitorVendorDeepLinkListener />
        <VendorSharePathBootstrap />
        <NavigationBackBridge />
        <StaticImagePrewarm />
        <CartProvider>
          <SearchContextProvider>
            <CommerceConfigProvider>
              <ScrollToTop />
              <Suspense fallback={null}>
                <AnalyticsRouteTracker />
              </Suspense>
              {children}
              <Toaster position="top-right" />
              {/* Only load DevTools in development mode - prevents bundle bloat in production */}
              {process.env.NODE_ENV === 'development' && (
                <Suspense fallback={null}>
                  <ReactQueryDevtools initialIsOpen={false} />
                </Suspense>
              )}
            </CommerceConfigProvider>
          </SearchContextProvider>
        </CartProvider>
      </ClientErrorBoundary>
    </QueryClientProvider>
  );
}
