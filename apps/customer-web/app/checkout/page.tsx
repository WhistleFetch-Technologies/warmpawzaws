'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { CheckoutView } from '@/components/customer/CheckoutView';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { goBackOrReplace } from '@/lib/go-back-or-replace';

export default function CheckoutPage() {
  const router = useRouter();
  const commerceEnabled = isCustomerEcommerceEnabled();
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let resolved = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '';
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
          onClick={() => goBackOrReplace(router, '/')}
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

  if (!phone) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-gray-600">
          Please sign in to checkout.{' '}
          <button
            type="button"
            className="font-semibold text-orange-600 underline"
            onClick={() => router.push('/auth')}
          >
            Sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <CheckoutView
      variant="standalone"
      phone={phone}
      onBack={() => goBackOrReplace(router, '/cart')}
      onSuccess={(orderId) => {
        if (orderId) {
          router.replace(`/orders/${orderId}/tracking`);
        } else {
          router.replace('/orders');
        }
      }}
    />
  );
}
