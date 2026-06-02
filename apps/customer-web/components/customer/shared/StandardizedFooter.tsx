'use client';

import { BottomNavigation } from '../bottomNavigation/BottomNavigation';

export type CustomerFooterTab = 'home' | 'shop' | 'bookings' | 'profile';

interface StandardizedFooterProps {
  currentTab?: CustomerFooterTab;
  onTabChange?: (tab: CustomerFooterTab) => void;
  /** @deprecated BottomNavigation uses max-w-customer; kept for call-site compatibility. */
  maxWidth?: string;
}

function tabToScreen(tab: CustomerFooterTab): string {
  if (tab === 'bookings') return 'my-bookings';
  if (tab === 'profile') return 'customer-profile';
  return tab;
}

function screenToTab(screen: string): CustomerFooterTab | null {
  if (screen === 'home') return 'home';
  if (screen === 'shop') return 'shop';
  if (screen === 'my-bookings' || screen === 'appointments' || screen === 'bookings') {
    return 'bookings';
  }
  if (
    screen === 'profile' ||
    screen === 'customer-profile' ||
    screen === 'user-profile' ||
    screen === 'my-packages'
  ) {
    return 'profile';
  }
  return null;
}

/** Vet/boarding subflows — thin adapter over shared BottomNavigation. */
export function StandardizedFooter({
  currentTab = 'home',
  onTabChange,
}: StandardizedFooterProps) {
  return (
    <BottomNavigation
      currentScreen={tabToScreen(currentTab)}
      onNavigate={(screen) => {
        const tab = screenToTab(screen);
        if (tab) onTabChange?.(tab);
      }}
    />
  );
}
