'use client';

import { Suspense, useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { EcommerceCartScreen } from '@/components/ecommerce/cart/EcommerceCartScreen';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';

function CartPageContent() {
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
          <ShoppingCart className="h-5 w-5 text-gray-700" />
        </button>
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-orange-200" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="text-gray-500">The marketplace cart will be available when the shop launches.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#F2F4F7] mx-auto max-w-customer lg:max-w-ecommerce">
      <EcommerceCartScreen phone={phone} />
    </div>
  );
}

export default function CartPage() {
  return (
    <AppReviewDemoRouteGuard>
      <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-[#F2F4F7]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <CartPageContent />
    </Suspense>
    </AppReviewDemoRouteGuard>
  );
}
