'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { InsuranceDashboardPage } from '@/components/admin/warmpawz-insurance/dashboard/InsuranceDashboardPage';

export default function WarmpawzInsuranceDashboardRoutePage() {
  return (
    <AdminLayout>
      <InsuranceDashboardPage />
    </AdminLayout>
  );
}
