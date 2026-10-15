'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Columns3,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  User,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { signOutVendor } from '@/lib/session-utils';
import { InsuranceWorkspace, type InsuranceWorkspaceTab } from './InsuranceWorkspace';

export type InsuranceShellTab = 'home' | 'kanban' | 'chat' | 'forms';

const DESKTOP_MQ = '(min-width: 1024px)';

export const INSURANCE_VENDOR_NAV: {
  id: InsuranceShellTab;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  panel?: InsuranceWorkspaceTab;
}[] = [
  { id: 'home', label: 'Home', description: 'Profile, services, and schedule', icon: LayoutDashboard },
  { id: 'kanban', label: 'Kanban', description: 'Applications', icon: Columns3, panel: 'Kanban' },
  { id: 'chat', label: 'Chat', description: 'Customer conversations', icon: MessageSquare, panel: 'Chat' },
  { id: 'forms', label: 'Form Library', description: 'Customer forms', icon: Library, panel: 'Form Library' },
];

export function InsuranceVendorShell({
  vendorId,
  vendorPhone,
  vendorName,
  children,
}: {
  vendorId: string;
  vendorPhone?: string;
  vendorName?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<InsuranceShellTab>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const active = INSURANCE_VENDOR_NAV.find((item) => item.id === tab) ?? INSURANCE_VENDOR_NAV[0];
  const wide = desktop && sidebarOpen;
  const chromeLeft = desktop ? (sidebarOpen ? '18rem' : '5rem') : '0px';

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => {
      setDesktop(mq.matches);
      setSidebarOpen(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const selectTab = (next: InsuranceShellTab) => {
    setTab(next);
    if (!window.matchMedia(DESKTOP_MQ).matches) setSidebarOpen(false);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      /* session clear still proceeds */
    }
    await signOutVendor();
    router.replace('/auth');
  };

  return (
    <div
      className="flex h-[100dvh] min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 to-orange-50/30"
      style={{ '--vendor-chrome-left': chromeLeft } as CSSProperties}
    >
      {sidebarOpen && !desktop ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r border-orange-100/50 bg-white/90 shadow-lg backdrop-blur-xl transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        } lg:pointer-events-auto lg:static lg:z-auto lg:translate-x-0 ${wide ? 'lg:w-72' : 'lg:w-20'}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-orange-100/50 px-4">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-lg shadow-orange-500/25 ring-2 ring-orange-100">
                  <Image src="/warmpawz-logo.svg" alt="Warmpawz" width={48} height={48} className="h-full w-full object-cover" priority />
                </div>
                <div>
                  <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-xl font-bold text-transparent">
                    Insurance
                  </span>
                  <p className="text-xs text-slate-500">Vendor home</p>
                </div>
              </div>
              <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-xl p-2 hover:bg-orange-50" aria-label="Collapse menu">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSidebarOpen(true)} className="mx-auto rounded-xl p-2 hover:bg-orange-50" aria-label="Expand menu">
              <Menu className="h-5 w-5 text-slate-600" />
            </button>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {INSURANCE_VENDOR_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                    : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen ? (
                  <span className="text-left">
                    <span className="block font-medium">{item.label}</span>
                    {!isActive ? <span className="text-xs text-slate-400">{item.description}</span> : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-orange-100/50 p-4">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-md">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{vendorName || 'Insurance vendor'}</p>
                  <p className="text-xs font-medium text-orange-600">Pet Insurance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void logout()} className="w-full rounded-xl p-3 text-red-600 hover:bg-red-50" title="Logout">
              <LogOut className="mx-auto h-5 w-5" />
            </button>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          className="fixed left-3 top-3 z-[80] flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow lg:hidden"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5 text-slate-600" />
        </button>
        {tab === 'home' ? (
          children
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <InsuranceWorkspace
              vendorId={vendorId}
              vendorPhone={vendorPhone}
              vendorName={vendorName}
              panel={active.panel}
            />
          </div>
        )}
      </div>
    </div>
  );
}
