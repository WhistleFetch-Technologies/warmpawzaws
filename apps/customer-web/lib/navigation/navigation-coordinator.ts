import { goBackOrReplace } from './back-intent-store';
import {
  normalizeShopProductId,
  SHOP_PRODUCT_PLACEHOLDER_PATH,
} from '../shop-product-path';
import { isCurrentPath, orderTrackingPath, productPath } from './route-registry';
import type { RoutePolicy } from './route-registry';

export type CoordinatorRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
};

export function navigateWithPolicy(
  router: CoordinatorRouter,
  path: string,
  policy: RoutePolicy = 'push',
): void {
  if (policy === 'replace') {
    router.replace(path);
    return;
  }
  if (policy === 'reset') {
    router.replace(path);
    return;
  }
  router.push(path);
}

/** URL-layer back with fallback (WebView-safe). */
export function coordinateUrlBack(router: CoordinatorRouter, fallbackPath: string): void {
  goBackOrReplace(router, fallbackPath);
}

/** Skip push when already on the same product URL. */
export function shouldSkipProductNavigation(productId: string): boolean {
  if (typeof window === 'undefined') return false;
  const id = String(productId || '').trim();
  if (!id) return true;
  if (isCurrentPath(window.location.pathname, productPath(id))) return true;
  const qs = new URLSearchParams(window.location.search);
  const current = normalizeShopProductId(qs.get('productId') || qs.get('product_id'));
  if (
    current &&
    current === id &&
    isCurrentPath(window.location.pathname, SHOP_PRODUCT_PLACEHOLDER_PATH)
  ) {
    return true;
  }
  return false;
}

export function afterUrlCheckoutSuccess(router: CoordinatorRouter, orderId: string | null | undefined): void {
  if (orderId) {
    router.replace(orderTrackingPath(orderId));
    return;
  }
  router.replace('/orders');
}

/** Hard replace after Razorpay — avoids empty-cart flash on /checkout before success UI loads. */
export function navigateToCheckoutSuccessPage(): void {
  if (typeof window === 'undefined') return;
  window.location.replace('/checkout/success');
}
