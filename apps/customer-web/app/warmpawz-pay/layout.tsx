'use client';

import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';

export default function WarmpawzPayLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { handleTabbedBottomNav, accountSidebar } = useCustomerAccountSidebarHost();

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-[var(--customer-tabbed-nav-offset)]">{children}</div>
      <BottomNavigation
        currentScreen="warmpawz-pay"
        onNavigate={(screen) => {
          if (screen === 'warmpawz-pay') return;
          handleTabbedBottomNav(screen);
        }}
        onProfileClick={() => handleTabbedBottomNav('profile')}
      />
      {accountSidebar}
    </>
  );
}
