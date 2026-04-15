'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  formatRequiredPermissions,
  getAdminRouteGateRule,
  type AdminRouteGateRule,
} from '@/lib/admin-route-permissions';
import { hasAdminPortalPermission } from '@/lib/admin-permissions';

type Phase = 'loading' | 'allowed' | 'denied';

function AccessDeniedPanel({ rule }: { rule: AdminRouteGateRule }) {
  const required = formatRequiredPermissions(rule);
  return (
    <div className="max-w-lg mx-auto mt-16 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <h1 className="text-lg font-semibold text-red-900">Access denied</h1>
      <p className="text-sm text-red-800 mt-2">
        You do not have permission to open this page. One of these is required:{' '}
        <code className="font-mono bg-red-100 px-1 rounded text-xs">{required}</code>
        {rule.hint ? (
          <>
            <br />
            <span className="text-red-900/90 mt-2 inline-block">{rule.hint}</span>
          </>
        ) : null}
      </p>
      <p className="text-xs text-red-700/80 mt-4">
        Full admin access (<code className="font-mono">admin.full_access</code>) also grants entry.
      </p>
    </div>
  );
}

/**
 * Refreshes permissions from /admin/auth/me (same idea as roles/page.tsx), then
 * enforces getAdminRouteGateRule for the current path. If there is no rule, children render.
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [phase, setPhase] = useState<Phase>('loading');
  const [deniedRule, setDeniedRule] = useState<AdminRouteGateRule | null>(null);

  useEffect(() => {
    let cancelled = false;
    const rule = getAdminRouteGateRule(pathname);

    (async () => {
      try {
        const { apiClient } = await import('@/lib/api-client');
        const me = await apiClient.get<{ success?: boolean; permissions?: string[] }>('/admin/auth/me');
        if (!cancelled && me && me.success !== false && Array.isArray(me.permissions)) {
          const perms = me.permissions.length ? me.permissions : ['admin.full_access'];
          localStorage.setItem('adminPermissions', JSON.stringify(perms));
        }
      } catch {
        // Stale token — keep existing localStorage permissions for the check below
      }

      if (cancelled) return;

      if (!rule) {
        setDeniedRule(null);
        setPhase('allowed');
        return;
      }

      const ok = hasAdminPortalPermission(rule.permission);
      if (ok) {
        setDeniedRule(null);
        setPhase('allowed');
      } else {
        setDeniedRule(rule);
        setPhase('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">
        Checking access…
      </div>
    );
  }

  if (phase === 'denied' && deniedRule) {
    return <AccessDeniedPanel rule={deniedRule} />;
  }

  return <>{children}</>;
}
