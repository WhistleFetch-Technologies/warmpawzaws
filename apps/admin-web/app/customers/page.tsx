'use client';

export const dynamic = 'force-dynamic';

import { AdminCustomerManagement } from '@/components/admin/AdminCustomerManagement';
import { AdminRouteGuard } from '@/components/admin/layout/AdminRouteGuard';
import { hrefForAdminSidebarView } from '@/lib/admin-sidebar-nav';

export default function CustomersPage() {
  return (
    <AdminRouteGuard>
      <AdminCustomerManagement
        onNavigate={(view) => {
          window.location.href = hrefForAdminSidebarView(view);
        }}
      />
    </AdminRouteGuard>
  );
}
