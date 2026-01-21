'use client';

import React from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { RBACManagement } from '@/components/admin/rbac/RBACManagement';

export default function RolesPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <RBACManagement />
      </div>
    </AdminLayout>
  );
}
