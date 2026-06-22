'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package2 } from 'lucide-react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import {
  MyPackagesTrackingPanel,
  mapPackagesApiToSummaryRows,
  type MyPackageSummaryRow,
} from '@/components/customer/booking/MyPackagesTrackingPanel';
import { MyPackagesHeaderBackground } from '@/components/customer/booking/MyPackagesHeaderBackground';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { apiClient } from '@/lib/api-client';
import { handleMyPackagesPageBack } from '@/lib/go-back-or-replace';
import { useCustomerAccountSidebarHost, CustomerAccountSidebarShell } from '@/lib/customer-account-sidebar-host';
import { CustomerBookingMessagesModalProvider } from '@/components/customer/messaging/CustomerBookingMessagesModalProvider';

/**
 * Viewport-bound column so `flex-1 min-h-0 overflow-y-auto` gets a real height and scrolls.
 * (Only `min-h-[100dvh]` lets the shell grow with content, so inner overflow never activates.)
 */
const PAGE_OUTER_CLASS =
  'flex h-[100dvh] max-h-[100dvh] min-h-0 w-full justify-center overflow-hidden bg-[#FAF6F0]';
const SHELL_CLASS =
  'flex h-full min-h-0 w-full max-w-customer flex-col overflow-hidden bg-[#FAF6F0] shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';

function MyPackagesPageInner() {
  const router = useRouter();
  const { accountSidebar, handleTabbedBottomNav, openAccountMenu, isAccountMenuOpen } = useCustomerAccountSidebarHost();
  const [phone, setPhone] = useState<string | null>(null);
  const [rows, setRows] = useState<MyPackageSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone');
    setPhone(p);
  }, []);

  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = (await apiClient.get(
          `/customer/${encodeURIComponent(phone)}/packages`
        )) as { packages?: unknown };
        if (!cancelled) setRows(mapPackagesApiToSummaryRows(res?.packages));
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const header = (
    <ServiceDashboardHeader
      className="sticky top-0 z-40 shrink-0"
      serviceName="My packages"
      serviceSubtitle="Track your sessions, benefits and usage"
      serviceIcon={Package2}
      stats={[]}
      onCloseToHome={() => router.push('/')}
      onBack={() => handleMyPackagesPageBack(router)}
      showBackButton
      bottomEdge="sheet"
      sheetToneClass="bg-[#FAF6F0]"
      headerBackground={<MyPackagesHeaderBackground />}
    />
  );

  if (!phone) {
    return (
      <CustomerBookingMessagesModalProvider phone="">
        <CustomerAccountSidebarShell
        sidebarOpen={isAccountMenuOpen}
        accountSidebar={accountSidebar}
        bottomNav={
          <BottomNavigation
            currentScreen="my-packages"
            onNavigate={handleTabbedBottomNav}
            onProfileClick={openAccountMenu}
            profileMenuOpen={isAccountMenuOpen}
          />
        }
      >
        <div className={PAGE_OUTER_CLASS}>
          <div className={SHELL_CLASS}>
            {header}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-6 pb-[var(--customer-tabbed-nav-offset)] text-center">
              <p className="text-gray-600">Please login to view your packages</p>
              <Link
                href="/auth"
                className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-3 font-medium text-white"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </CustomerAccountSidebarShell>
      </CustomerBookingMessagesModalProvider>
    );
  }

  return (
    <CustomerBookingMessagesModalProvider phone={phone}>
    <CustomerAccountSidebarShell
      sidebarOpen={isAccountMenuOpen}
      accountSidebar={accountSidebar}
      bottomNav={
        <BottomNavigation
          currentScreen="my-packages"
          onNavigate={handleTabbedBottomNav}
          onProfileClick={openAccountMenu}
          profileMenuOpen={isAccountMenuOpen}
        />
      }
    >
      <div className={PAGE_OUTER_CLASS}>
        <div className={SHELL_CLASS}>
          {header}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[var(--customer-tabbed-nav-offset)]">
            {loading ? (
              <div className="flex flex-col items-center justify-center px-6 py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
                <p className="mt-5 text-sm font-medium text-gray-600">Loading your packages…</p>
              </div>
            ) : (
              <MyPackagesTrackingPanel rows={rows} customerPhone={phone} variant="fullPage" />
            )}
          </div>
        </div>
      </div>
    </CustomerAccountSidebarShell>
    </CustomerBookingMessagesModalProvider>
  );
}

export default function MyPackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#FAF6F0] p-6 text-gray-600">
          Loading…
        </div>
      }
    >
      <MyPackagesPageInner />
    </Suspense>
  );
}
