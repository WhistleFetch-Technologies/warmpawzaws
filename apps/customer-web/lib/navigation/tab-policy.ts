import type { CustomerTabId } from './route-registry';
import { CUSTOMER_ROUTES } from './route-registry';
import {
  clearProfileNavigationResumeIntents,
  clearShopBackIntent,
  clearWishlistOpenedFromShopMark,
} from './back-intent-store';

export type TabNavigationRouter = {
  push: (href: string) => void;
  replace?: (href: string) => void;
};

export type TabNavigationHandlers = {
  openProfile?: () => void;
};

/**
 * Bottom-tab navigation with stack-clear policy:
 * - Home: `/` + clear shop/wishlist back intents
 * - Shop: fresh `/shop` root (no restored depth)
 * - Bookings: `/bookings`
 * - Profile: overlay (caller provides openProfile)
 */
export function navigateCustomerTab(
  router: TabNavigationRouter,
  tab: CustomerTabId,
  handlers?: TabNavigationHandlers,
): void {
  if (tab === 'profile') {
    handlers?.openProfile?.();
    return;
  }

  if (tab === 'home') {
    clearShopBackIntent();
    clearWishlistOpenedFromShopMark();
    clearProfileNavigationResumeIntents();
    router.push(CUSTOMER_ROUTES.home.path);
    return;
  }

  if (tab === 'shop') {
    clearShopBackIntent();
    clearProfileNavigationResumeIntents();
    router.push(CUSTOMER_ROUTES.shop.path);
    return;
  }

  if (tab === 'bookings') {
    clearProfileNavigationResumeIntents();
    router.push(CUSTOMER_ROUTES.bookings.path);
  }
}
