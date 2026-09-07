'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';
import { handleWpayPageBack } from '@/lib/go-back-or-replace';
import { BACK_HANDLER_PRIORITY, registerBackHandler } from '@/lib/navigation/back-handler-registry';

const WPAY_VENDORS_PATH = '/warmpawz-pay';

function isWpayHubOrVendorPath(pathname: string): boolean {
  const path = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (!path.startsWith('/warmpawz-pay')) return false;
  if (path.startsWith('/warmpawz-pay/history') || path.startsWith('/warmpawz-pay/success')) {
    return false;
  }
  return true;
}

export default function WarmpawzPayLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { handleTabbedBottomNav, accountSidebar } = useCustomerAccountSidebarHost();
  const onVendorsList =
    pathname === WPAY_VENDORS_PATH || pathname === `${WPAY_VENDORS_PATH}/`;

  useEffect(() => {
    return registerBackHandler(() => {
      const path = typeof window !== 'undefined' ? window.location.pathname : pathname || '';
      if (!isWpayHubOrVendorPath(path)) return false;
      handleWpayPageBack(router);
      return true;
    }, BACK_HANDLER_PRIORITY.urlHistory + 5);
  }, [pathname, router]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-[var(--customer-tabbed-nav-offset)]">{children}</div>
      <BottomNavigation
        currentScreen="warmpawz-pay"
        onNavigate={(screen) => {
          if (screen === 'warmpawz-pay') {
            // History / vendor detail share this layout; PAY BILL must open published vendors.
            if (!onVendorsList) {
              router.push(WPAY_VENDORS_PATH);
            }
            return;
          }
          handleTabbedBottomNav(screen);
        }}
        onProfileClick={() => handleTabbedBottomNav('profile')}
      />
      {accountSidebar}
    </>
  );
}
