'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, useEffect, lazy, Suspense } from 'react';
import { registerCustomerQueryClientReset } from '@/lib/session-utils';
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
import { LocationProvider } from '@/context/LocationContext';
import { GuestLocationPrompt } from '@/components/customer/GuestLocationPrompt';
import { GuestSessionAnalyticsBootstrap } from '@/components/customer/GuestSessionAnalyticsBootstrap';
import { GuestAuthModalProvider } from '@/components/customer/auth/GuestAuthModalProvider';

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

  useEffect(() => {
    registerCustomerQueryClientReset(() => queryClient.clear());
    return () => registerCustomerQueryClientReset(null);
  }, [queryClient]);

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
              <LocationProvider>
                <GuestAuthModalProvider>
                  <GuestSessionAnalyticsBootstrap />
                  <ScrollToTop />
                  <Suspense fallback={null}>
                    <AnalyticsRouteTracker />
                  </Suspense>
                  {children}
                  <GuestLocationPrompt />
                  <Toaster position="top-right" />
                  {/* Only load DevTools in development mode - prevents bundle bloat in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <Suspense fallback={null}>
                      <ReactQueryDevtools initialIsOpen={false} />
                    </Suspense>
                  )}
                </GuestAuthModalProvider>
              </LocationProvider>
            </CommerceConfigProvider>
          </SearchContextProvider>
        </CartProvider>
      </ClientErrorBoundary>
    </QueryClientProvider>
  );
}
