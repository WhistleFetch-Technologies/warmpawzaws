'use client';
export const dynamic = 'force-dynamic';

import { AdminRefundsPage } from '@/components/admin/AdminRefundsPage';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function RefundsPage() {
  return (
    <AdminLayout>
      <AdminRefundsPage />
    </AdminLayout>
  );
}

