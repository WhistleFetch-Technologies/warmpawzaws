'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { CustomerShopOrdersScreen } from '@/components/customer/CustomerShopOrdersScreen';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { handleOrdersPageBack } from '@/lib/go-back-or-replace';
import {
  BACK_HANDLER_PRIORITY,
  registerBackHandler,
} from '@/lib/navigation/back-handler-registry';
import { useRouter } from 'next/navigation';

function OrdersComingSoonView() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    handleOrdersPageBack(router);
  }, [router]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (typeof window === 'undefined') return false;
      if (window.location.pathname !== '/orders') return false;
      handleOrdersPageBack(router);
      return true;
    }, BACK_HANDLER_PRIORITY.urlHistory + 5);
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-orange-100/80 bg-white/95 px-4 py-3 backdrop-blur cw-header-safe-top cw-header-safe-x">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-sm font-semibold text-gray-800 hover:bg-orange-50 active:opacity-90"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          Back
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Package className="h-5 w-5 shrink-0 text-[#FF8C42]" strokeWidth={2} />
          <h1 className="truncate text-lg font-bold text-gray-900">My Orders</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <Package className="mx-auto mb-4 h-16 w-16 text-orange-200" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="text-gray-500">
            Shop orders will appear here once the Warmpawz marketplace launches.
          </p>
        </div>
      </div>
    </div>
  );
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const expand = searchParams.get('expand');

  if (!isCustomerEcommerceEnabled()) {
    return <OrdersComingSoonView />;
  }

  return <CustomerShopOrdersScreen initialExpandedOrderId={expand} />;
}

export default function OrdersPage() {
  return (
    <AppReviewDemoRouteGuard>
      <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-[#FAF6F0]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
    </AppReviewDemoRouteGuard>
  );
}
