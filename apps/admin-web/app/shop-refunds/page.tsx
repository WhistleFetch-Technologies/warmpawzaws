'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { ShopRefundsPageContent } from '@/components/admin/shop-refunds/ShopRefundsPageContent';

export default function ShopRefundsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
          Loading shop refunds…
        </div>
      }
    >
      <ShopRefundsPageContent />
    </Suspense>
  );
}
