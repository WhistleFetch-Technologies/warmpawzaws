'use client';

import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { CustomerShopOrdersScreen } from '@/components/customer/CustomerShopOrdersScreen';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { goBackOrReplace } from '@/lib/go-back-or-replace';

export default function OrdersPage() {
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
          <Package className="h-5 w-5 text-gray-700" />
        </button>
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <Package className="mx-auto mb-4 h-16 w-16 text-orange-200" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="text-gray-500">
            Shop orders will appear here once the Warmpawz marketplace launches.
          </p>
        </div>
      </div>
    );
  }

  return <CustomerShopOrdersScreen />;
}
