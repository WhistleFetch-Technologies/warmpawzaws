'use client';

import { Suspense } from 'react';
import { EcommerceOrderSuccessScreen } from '@/components/ecommerce/success/EcommerceOrderSuccessScreen';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';

function SuccessFallback() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-[#F2F4F7]">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
    </div>
  );
}

function SuccessContent() {
  if (!isCustomerEcommerceEnabled()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center text-slate-600">
        Marketplace checkout is not available yet.
      </div>
    );
  }
  return <EcommerceOrderSuccessScreen />;
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <SuccessContent />
    </Suspense>
  );
}
