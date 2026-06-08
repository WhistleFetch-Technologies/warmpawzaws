'use client';

import type { ReactNode } from 'react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import {
  CustomerAccountSidebarShell,
  useCustomerAccountSidebarHost,
} from '@/lib/customer-account-sidebar-host';

type EcommerceTabbedShellProps = {
  children: ReactNode;
  /** Bottom nav highlight — cart/checkout flows keep Shop active. */
  currentScreen?: string;
};

export function EcommerceTabbedShell({
  children,
  currentScreen = 'shop',
}: EcommerceTabbedShellProps) {
  const { accountSidebar, handleTabbedBottomNav, isAccountMenuOpen, openAccountMenu } =
    useCustomerAccountSidebarHost();

  return (
    <CustomerAccountSidebarShell
      sidebarOpen={isAccountMenuOpen}
      accountSidebar={accountSidebar}
      bottomNav={
        <BottomNavigation
          currentScreen={currentScreen}
          onNavigate={handleTabbedBottomNav}
          onProfileClick={openAccountMenu}
        />
      }
    >
      <div className="relative flex min-h-screen w-full flex-col bg-[#F2F4F7] mx-auto max-w-customer lg:max-w-ecommerce">
        {children}
      </div>
    </CustomerAccountSidebarShell>
  );
}
