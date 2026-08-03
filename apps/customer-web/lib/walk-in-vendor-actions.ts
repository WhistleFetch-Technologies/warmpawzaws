'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import {
  buildWarmpawzAppointmentsBookingNav,
  resolveWarmpawzBookingScreen,
} from '@/lib/warmpawz-appointments-customer';
import { buildSearchVendorDetailsUrl } from '@/lib/search-booking-launch';
import { withBannerNavigationOrigin } from '@/lib/banner-navigation-origin';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import type { HomeNavigateFn } from '@/components/customer/home/hooks/useHomeNavigation';
import { WALK_IN_VENDORS_PATH } from '@/lib/walk-in-constants';

export const WALK_IN_PENDING_SHELL_NAV_KEY = 'warmpawz_walk_in_pending_shell_nav';

export type WalkInPendingShellNav = {
  screen: string;
  data?: Record<string, unknown>;
  returnUrl?: string;
};

export function persistWalkInShellNav(
  screen: string,
  data?: Record<string, unknown>,
  returnUrl = WALK_IN_VENDORS_PATH
): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      WALK_IN_PENDING_SHELL_NAV_KEY,
      JSON.stringify({ screen, data, returnUrl } satisfies WalkInPendingShellNav)
    );
  } catch {
    /* quota */
  }
}

export function consumeWalkInShellNav(): WalkInPendingShellNav | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WALK_IN_PENDING_SHELL_NAV_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(WALK_IN_PENDING_SHELL_NAV_KEY);
    return JSON.parse(raw) as WalkInPendingShellNav;
  } catch {
    return null;
  }
}

export function payWalkInBill(provider: WalkInProvider, router: AppRouterInstance): void {
  const vendorId = String(provider.id ?? '').trim();
  if (!vendorId) return;
  launchWarmpawzPayServiceBooking({
    router,
    serviceKey: provider.category,
    category: provider.category,
    vendorId,
  });
}

export function openWalkInVendorDetails(provider: WalkInProvider, router: AppRouterInstance): void {
  const vendorId = String(provider.id ?? '').trim();
  if (!vendorId) return;
  router.push(
    buildSearchVendorDetailsUrl(vendorId, provider.displayName, provider.category)
  );
}

export function bookWalkInAppointment(
  provider: WalkInProvider,
  router: AppRouterInstance,
  onNavigate?: HomeNavigateFn
): void {
  const vendorId = String(provider.id ?? '').trim();
  if (!vendorId) return;

  const screen = resolveWarmpawzBookingScreen(provider.category);
  const bookingPayload = {
    ...buildWarmpawzAppointmentsBookingNav({
      vendorId,
      vendorName: provider.displayName,
      serviceStyle: 'at_center',
      category: provider.category,
    }),
    appointmentsMode: true,
  };

  if (onNavigate) {
    onNavigate(screen, bookingPayload);
    return;
  }

  const data = withBannerNavigationOrigin(bookingPayload, WALK_IN_VENDORS_PATH);
  persistWalkInShellNav(screen, data);
  router.push('/');
}

export function useWalkInVendorActions(onNavigate?: HomeNavigateFn) {
  const router = useRouter();

  const payBill = useCallback(
    (provider: WalkInProvider) => payWalkInBill(provider, router),
    [router]
  );

  const bookNow = useCallback(
    (provider: WalkInProvider) => bookWalkInAppointment(provider, router, onNavigate),
    [onNavigate, router]
  );

  const openVendorDetails = useCallback(
    (provider: WalkInProvider) => openWalkInVendorDetails(provider, router),
    [router]
  );

  return { payBill, bookNow, openVendorDetails };
}
