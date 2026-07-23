'use client';
export const dynamic = 'force-dynamic';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { DashboardPage } from '@/components/admin/warmpawz-pay/dashboard/DashboardPage';
import { WarmpawzPayShell } from '@/components/admin/warmpawz-pay/shared/WarmpawzPayShell';

export default function WarmpawzPayDashboardRoute() {
  return (
    <AdminLayout>
      <WarmpawzPayShell
        title="Warmpawz Pay"
        subtitle="Overview of published merchants and Warmpawz Pay activity."
      >
        <DashboardPage />
      </WarmpawzPayShell>
    </AdminLayout>
  );
}
