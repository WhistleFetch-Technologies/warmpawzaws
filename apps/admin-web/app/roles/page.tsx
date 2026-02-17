'use client';

import React from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { RBACManagement } from '@/components/admin/rbac/RBACManagement';
import { AuditLogPanel } from '@/components/admin/audit/AuditLogPanel';

export default function RolesPage() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <RBACManagement />
        <AuditLogPanel />
      </div>
    </AdminLayout>
  );
}
