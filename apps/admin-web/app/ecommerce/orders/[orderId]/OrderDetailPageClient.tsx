'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { AdminOrderDetailView } from '@/components/admin/ecommerce/orderManagementAdmin/AdminOrderDetailView';

function OrderDetailInner() {
  const params = useParams();
  const orderId = String(params.orderId || '');

  if (!orderId) {
    return <div className="p-8 text-slate-500">Invalid order ID</div>;
  }

  return <AdminOrderDetailView orderId={orderId} />;
}

export default function OrderDetailPageClient() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-8 text-slate-500">Loading order…</div>}>
        <OrderDetailInner />
      </Suspense>
    </AdminLayout>
  );
}
