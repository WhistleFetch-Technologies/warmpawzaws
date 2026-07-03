'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { PolicyCenter } from '@/components/admin/marketing/policyCenter/PolicyCenter';

export default function PolicyCenterPage() {
  return (
    <AdminLayout>
      <PolicyCenter />
    </AdminLayout>
  );
}
