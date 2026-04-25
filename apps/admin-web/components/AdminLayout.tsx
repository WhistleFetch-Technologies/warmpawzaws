'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStoredAdminPermissions, hasAdminPortalPermission } from '@/lib/admin-permissions';
import { apiClient } from '@/lib/api-client';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const menuItems: { id: string; icon: string; label: string; href: string; permission: string }[] = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', href: '/', permission: 'admin.dashboard' },
  { id: 'analytics', icon: '📈', label: 'Analytics', href: '/analytics', permission: 'admin.analytics' },
  { id: 'vendors', icon: '🏪', label: 'Vendors', href: '/vendors', permission: 'admin.vendors' },
  { id: 'roles', icon: '👤', label: 'Roles & User Management', href: '/roles', permission: 'admin.roles' },
  { id: 'catalog', icon: '📚', label: 'Service Catalog', href: '/catalog', permission: 'admin.catalog' },
  { id: 'settlements', icon: '💰', label: 'Settlements', href: '/settlements', permission: 'admin.settlements' },
  { id: 'reports', icon: '📋', label: 'Reports', href: '/reports', permission: 'admin.reports' },
  { id: 'integrations', icon: '🔗', label: 'Integrations', href: '/integrations', permission: 'admin.integrations' },
  { id: 'governance', icon: '🏛️', label: 'Governance', href: '/governance', permission: 'admin.governance' },
  { id: 'logistics', icon: '🚚', label: 'Logistics', href: '/logistics', permission: 'admin.logistics' },
  { id: 'refunds', icon: '💸', label: 'Refunds', href: '/refunds', permission: 'admin.refunds' },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  // usePathname must be called unconditionally (React hook rule)
  // During static generation, it will return the current route or '/'
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [permTick, setPermTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'adminPermissions' || e.key === 'adminAuthToken') setPermTick((t) => t + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  const visibleMenuItems = useMemo(() => {
    if (!mounted) return menuItems;
    const perms = getStoredAdminPermissions();
    if (perms.includes('admin.full_access') || perms.includes('*')) return menuItems;
    return menuItems.filter((item) => hasAdminPortalPermission(item.permission));
  }, [mounted, permTick]);

  const isActive = (href: string) => {
    if (!mounted) return false; // During static generation, don't highlight
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href) || false;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white overflow-y-auto z-40">
        <div className="p-0 border-b border-slate-700">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-xl">
              🐾
            </div>
            <div>
              <h1 className="text-xl font-bold">Warmpawz</h1>
              <p className="text-xs text-slate-400">Admin Portal</p>
            </div>
          </Link>
        </div>
        
        <nav className="p-4 space-y-1">
          {visibleMenuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-0 rounded-lg transition ${
                isActive(item.href)
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              👤
            </div>
            <div>
              <p className="text-sm font-medium">Admin</p>
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    apiClient.clearAuth();
                    sessionStorage.removeItem('_warmpawz_admin_has_session');
                    window.location.href = '/';
                  }
                }}
                className="text-xs text-slate-400 hover:text-orange-400 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
}

