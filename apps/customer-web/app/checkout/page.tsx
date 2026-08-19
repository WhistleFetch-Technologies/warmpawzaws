'use client';

import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { CheckoutProvider } from '@/context/CheckoutProvider';
import { CheckoutFlow } from '@/components/ecommerce/checkout/CheckoutFlow';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { hasAuthenticatedCustomerSession } from '@/lib/guest-auth-gate';

function CheckoutPageContent() {
  const nav = useCustomerNavigation();
  const commerceEnabled = isCustomerEcommerceEnabled();
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let resolved =
      localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '';
    if (!resolved) {
      try {
        const raw = localStorage.getItem('customerData');
        if (raw) {
          const data = JSON.parse(raw) as { phone?: string };
          if (data.phone) resolved = String(data.phone);
        }
      } catch {
        /* ignore */
      }
    }
    setPhone(resolved);
  }, []);

  if (!commerceEnabled) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
        <button
          type="button"
          onClick={() => nav.backOr('/')}
          className="absolute left-4 top-4 rounded-lg bg-white/90 p-2 shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-orange-200" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="text-gray-500">Checkout will be available when the marketplace launches.</p>
        </div>
      </div>
    );
  }

  if (!phone || !hasAuthenticatedCustomerSession()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 max-w-customer mx-auto">
        <p className="text-center text-gray-600">
          Please sign in to checkout.{' '}
          <button
            type="button"
            className="font-semibold text-orange-600 underline"
            onClick={() => nav.goToAuth('/checkout')}
          >
            Sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#F2F4F7] mx-auto max-w-customer lg:max-w-ecommerce">
      <CheckoutProvider phone={phone}>
        <CheckoutFlow />
      </CheckoutProvider>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <AppReviewDemoRouteGuard>
      <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-[#F2F4F7]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
    </AppReviewDemoRouteGuard>
  );
}
