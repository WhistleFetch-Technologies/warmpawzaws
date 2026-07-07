import {
  coordinateUrlBack,
  afterUrlCheckoutSuccess,
  navigateToCheckoutSuccessPage,
  navigateWithPolicy,
  shouldSkipProductNavigation,
  type CoordinatorRouter,
} from './navigation-coordinator';
import { shopProductDetailPath } from '../shop-product-path';
import { CUSTOMER_ROUTES } from './route-registry';
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
      router.push(shopProductDetailPath(id));
    },

    goToCart(opts?: { replace?: boolean; buynow?: boolean }) {
      const path = opts?.buynow
        ? `${CUSTOMER_ROUTES.cart.path}?buynow=1`
        : CUSTOMER_ROUTES.cart.path;
      if (opts?.replace) {
        router.replace(path);
        return;
      }
      router.push(path);
    },

    goToCheckout(opts?: { step?: 'payment' | 'review' }) {
      const path = opts?.step
        ? `${CUSTOMER_ROUTES.checkout.path}?step=${opts.step}`
        : CUSTOMER_ROUTES.checkout.path;
      router.push(path);
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

    /** Celebration screen after payment — hard replace clears checkout from history. */
    goToCheckoutSuccess() {
      navigateToCheckoutSuccessPage();
    },

    /** Post-success navigation to tracking/orders — Back cannot return to checkout. */
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
