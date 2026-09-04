'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';

const WPAY_VENDORS_PATH = '/warmpawz-pay';

export default function WarmpawzPayLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { handleTabbedBottomNav, accountSidebar } = useCustomerAccountSidebarHost();
  const onVendorsList =
    pathname === WPAY_VENDORS_PATH || pathname === `${WPAY_VENDORS_PATH}/`;

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
