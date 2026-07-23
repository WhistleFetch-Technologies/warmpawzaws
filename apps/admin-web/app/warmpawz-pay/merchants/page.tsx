'use client';
export const dynamic = 'force-dynamic';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { MerchantsDashboardPage } from '@/components/admin/warmpawz-pay/merchants/MerchantsDashboardPage';

export default function WarmpawzPayMerchantsPage() {
  return (
    <AdminLayout>
      <MerchantsDashboardPage />
    </AdminLayout>
  );
}
