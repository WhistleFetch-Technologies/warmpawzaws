'use client';

export const dynamic = 'force-dynamic';

import { AdminCustomerManagement } from '@/components/admin/AdminCustomerManagement';
import { AdminRouteGuard } from '@/components/admin/layout/AdminRouteGuard';

export default function CustomersPage() {
  return (
    <AdminRouteGuard>
      <AdminCustomerManagement
        onNavigate={(view) => {
          if (view === 'customer-admin') {
            window.location.href = '/customers';
            return;
          }
          window.location.href = `/${view}`;
        }}
      />
    </AdminRouteGuard>
  );
}
