'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { RefundsPageContent } from '@/components/admin/refunds/RefundsPageContent';

export default function RefundsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
          Loading refunds…
        </div>
      }
    >
      <RefundsPageContent />
    </Suspense>
  );
}
