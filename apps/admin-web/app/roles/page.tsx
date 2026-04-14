'use client';

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { RBACManagement } from '@/components/admin/rbac/RBACManagement';
import { canAccessRbacPage } from '@/lib/admin-permissions';

export default function RolesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { apiClient } = await import('@/lib/api-client');
        const me = await apiClient.get<{ success?: boolean; permissions?: string[] }>('/admin/auth/me');
        if (cancelled) return;
        if (me && me.success !== false && Array.isArray(me.permissions)) {
          const perms = me.permissions.length ? me.permissions : ['admin.full_access'];
          localStorage.setItem('adminPermissions', JSON.stringify(perms));
        }
      } catch {
        // Stale or missing token — fall back to permissions already in localStorage from login
      }
      if (!cancelled) {
        setAllowed(canAccessRbacPage());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout>
      <div className="p-6">
        {allowed === null && (
          <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">Checking access…</div>
        )}
        {allowed === false && (
          <div className="max-w-lg mx-auto mt-16 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="text-lg font-semibold text-red-900">Access denied</h1>
            <p className="text-sm text-red-800 mt-2">
              You need the <code className="font-mono bg-red-100 px-1 rounded">admin.roles</code> permission (or full admin access) to open RBAC management.
            </p>
          </div>
        )}
        {allowed === true && <RBACManagement />}
      </div>
    </AdminLayout>
  );
}
