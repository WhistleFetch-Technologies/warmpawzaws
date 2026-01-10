'use client';
export const dynamic = 'force-dynamic';

import { AdminLogisticsPage } from '@/components/admin/AdminLogisticsPage';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function LogisticsPage() {
  return (
    <AdminLayout>
      <AdminLogisticsPage />
    </AdminLayout>
  );
}

