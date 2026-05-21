'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { ShoppingCartView } from '@/components/customer/ShoppingCartView';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { goBackOrReplace } from '@/lib/go-back-or-replace';

function CartPageContent() {
  const router = useRouter();
  const commerceEnabled = isCustomerEcommerceEnabled();

  if (!commerceEnabled) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
        <button
          type="button"
          onClick={() => goBackOrReplace(router, '/')}
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
    <ShoppingCartView
      variant="standalone"
      onBack={() => goBackOrReplace(router, '/shop')}
      onContinueShopping={() => router.replace('/shop')}
      onCheckout={() => router.push('/checkout')}
    />
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-[#F2F4F7]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <CartPageContent />
    </Suspense>
  );
}
