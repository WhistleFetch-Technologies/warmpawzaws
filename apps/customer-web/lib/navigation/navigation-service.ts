import {
  coordinateUrlBack,
  afterUrlCheckoutSuccess,
  navigateWithPolicy,
  shouldSkipProductNavigation,
  type CoordinatorRouter,
} from './navigation-coordinator';
import { CUSTOMER_ROUTES, productPath } from './route-registry';
import { navigateCustomerTab, type TabNavigationHandlers } from './tab-policy';
import type { CustomerTabId } from './route-registry';

export type CustomerNavigation = ReturnType<typeof createCustomerNavigation>;

/**
 * Central navigation API for URL-layer routes (Next.js App Router).
 * Shell screens on `/` still use useShellNavigationStack in CustomerHomeWrapper.
 */
export function createCustomerNavigation(router: CoordinatorRouter) {
  return {
    goToHome() {
      navigateWithPolicy(router, CUSTOMER_ROUTES.home.path, 'reset');
    },

    goToShop(opts?: { replace?: boolean }) {
      navigateWithPolicy(
        router,
        CUSTOMER_ROUTES.shop.path,
        opts?.replace ? 'replace' : CUSTOMER_ROUTES.shop.policy,
      );
    },

    goToProduct(productId: string) {
      const id = String(productId || '').trim();
      if (!id || shouldSkipProductNavigation(id)) return;
      router.push(productPath(id));
    },

    goToCart() {
      router.push(CUSTOMER_ROUTES.cart.path);
    },

    goToCheckout() {
      router.push(CUSTOMER_ROUTES.checkout.path);
    },

    goToBookings() {
      router.push(CUSTOMER_ROUTES.bookings.path);
    },

    goToWishlist() {
      router.push(CUSTOMER_ROUTES.wishlist.path);
    },

    goToAuth() {
      router.replace(CUSTOMER_ROUTES.auth.path);
    },

    /** Payment success — replace so Back cannot return to checkout/cart. */
    afterCheckoutSuccess(orderId: string | null | undefined) {
      afterUrlCheckoutSuccess(router, orderId);
    },

    backOr(fallbackPath: string) {
      coordinateUrlBack(router, fallbackPath);
    },

    handleTab(tab: CustomerTabId, handlers?: TabNavigationHandlers) {
      navigateCustomerTab(router, tab, handlers);
    },
  };
}

/** Embedded shell checkout on `/` — reset stack so Back skips checkout/cart. */
export function completeEmbeddedCheckoutSuccess<T extends string>(
  resetStack: (screen: T) => void,
  setOrderId: (orderId: string) => void,
  orderId: string,
  successScreen: T,
): void {
  setOrderId(orderId);
  resetStack(successScreen);
}

/** Embedded shell — view orders after success (no checkout in stack). */
export function completeEmbeddedCheckoutViewOrders<T extends string>(
  resetStack: (screen: T) => void,
  clearOrderId: () => void,
  ordersScreen: T,
): void {
  clearOrderId();
  resetStack(ordersScreen);
}
