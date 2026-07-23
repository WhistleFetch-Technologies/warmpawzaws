'use client';
export const dynamic = 'force-dynamic';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CatalogueDashboardPage } from '@/components/admin/warmpawz-pay/catalogue/CatalogueDashboardPage';

export default function WarmpawzPayCataloguePage() {
  return (
    <AdminLayout>
      <CatalogueDashboardPage />
    </AdminLayout>
  );
}
