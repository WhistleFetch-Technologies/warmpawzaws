'use client';

import { Suspense } from 'react';
import VendorMealDeliveryDetailClient from './VendorMealDeliveryDetailClient';

export default function VendorMealDeliveryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <VendorMealDeliveryDetailClient />
    </Suspense>
  );
}
