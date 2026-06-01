'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UserAccountSidebar } from '@/components/customer/UserAccountSidebar';
import { navigateFromStandaloneAccountMenu } from '@/lib/customer-account-sidebar-nav';
import { ProfileMenuOpenProvider } from '@/lib/profile-menu-open-context';

export { navigateFromStandaloneAccountMenu } from '@/lib/customer-account-sidebar-nav';

export type CustomerAccountSidebarHost = {
  phone: string | null;
  openAccountMenu: () => void;
  accountSidebar: ReactNode;
  isAccountMenuOpen: boolean;
  /** BottomNavigation: profile opens account menu; other tabs route by screen id. */
  handleTabbedBottomNav: (screen: string) => void;
};

export function useCustomerAccountSidebarHost(): CustomerAccountSidebarHost {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone');
    setPhone(p);
  }, []);

  const openAccountMenu = useCallback(() => {
    const p = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone');
    if (!p) {
      router.push('/auth');
      return;
    }
    setPhone(p);
    setSidebarOpen(true);
  }, [router]);

  const handleAccountNavigate = useCallback(
    (path: string) => {
      setSidebarOpen(false);
      navigateFromStandaloneAccountMenu(router, path);
    },
    [router]
  );

  const handleTabbedBottomNav = useCallback(
    (screen: string) => {
      if (screen === 'profile') {
        openAccountMenu();
        return;
      }
      setSidebarOpen(false);
      if (screen === 'home') router.push('/');
      else if (screen === 'cart') router.push('/cart');
      else if (screen === 'my-bookings') router.push('/bookings');
    },
    [openAccountMenu, router]
  );

  const accountSidebar =
    sidebarOpen && phone ? (
      <UserAccountSidebar
        phone={phone}
        onClose={() => setSidebarOpen(false)}
        onNavigateHome={() => {
          setSidebarOpen(false);
          router.push('/');
        }}
        onViewBooking={(bookingId) => {
          setSidebarOpen(false);
          router.push(`/bookings?reviewBookingId=${encodeURIComponent(bookingId)}`);
        }}
        onViewAppointments={() => {
          setSidebarOpen(false);
          router.push('/bookings');
        }}
        onViewWallet={() => {
          setSidebarOpen(false);
          router.push('/wallet');
        }}
        onViewMyPackages={() => {
          setSidebarOpen(false);
          router.push('/my-packages');
        }}
        onViewProfile={() => {
          setSidebarOpen(false);
          router.push('/profile');
        }}
        onNavigate={handleAccountNavigate}
      />
    ) : null;

  return {
    phone,
    openAccountMenu,
    accountSidebar,
    isAccountMenuOpen: sidebarOpen,
    handleTabbedBottomNav,
  };
}

/** Wrap standalone pages that render BottomNavigation + account sidebar overlay. */
export function CustomerAccountSidebarShell({
  children,
  sidebarOpen,
  bottomNav,
  accountSidebar,
}: {
  children: ReactNode;
  sidebarOpen: boolean;
  bottomNav: ReactNode;
  accountSidebar: ReactNode;
}) {
  return (
    <ProfileMenuOpenProvider value={sidebarOpen}>
      {children}
      {bottomNav}
      {accountSidebar}
    </ProfileMenuOpenProvider>
  );
}
