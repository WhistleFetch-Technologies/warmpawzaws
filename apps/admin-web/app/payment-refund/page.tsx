'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminRouteGuard } from '@/components/admin/layout/AdminRouteGuard';

/**
 * Legacy "Payment & Refund" route → Finance → Cancellation & Refund Policy (unified booking policies).
 */
export default function PaymentRefundPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/finance?tab=cancellation-policy');
  }, [router]);

  return (
    <AdminRouteGuard>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto" />
          <p className="mt-4 text-gray-600">
            Redirecting to Finance → Cancellation & Refund Policy…
          </p>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
