'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminRouteGuard } from '@/components/admin/layout/AdminRouteGuard';

/**
 * Payment & Refund - Redirects to Finance page with payment-policies tab.
 * Finance page contains Payment Policies and Refund Policies sections.
 */
export default function PaymentRefundPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/finance?tab=payment-policies');
  }, [router]);

  return (
    <AdminRouteGuard>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto" />
          <p className="mt-4 text-gray-600">Redirecting to Payment & Refund settings...</p>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
