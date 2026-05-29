/**
 * Customer marketplace launch gate (shop, cart, wishlist, orders).
 *
 * Automatically ON for non-production environments, OFF for production.
 * Uses runtime-config `environment` on the client and NEXT_PUBLIC_ENVIRONMENT at build/SSR.
 *
 * At full launch: change isCustomerEcommerceEnabled() to `return true` and remove call-site guards.
 */

function isProductionEnvironment(): boolean {
  if (typeof window !== 'undefined') {
    const env = window.__WARMPAWZ_RUNTIME_CONFIG__?.environment;
    if (env === 'production') return true;
    if (env === 'development') return false;
  }
  return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
}

export function isCustomerEcommerceEnabled(): boolean {
  return !isProductionEnvironment();
}

/** Toast / inline copy when shop, cart, wishlist, or product orders are disabled. */
export const CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE = 'Shop is coming soon.';

/** SPA screens owned by the marketplace (CustomerHomeWrapper). */
export const CUSTOMER_ECOMMERCE_SPA_SCREENS = new Set([
  'shop',
  'cart',
  'checkout',
  'order_success',
  'order_history',
  'order_detail',
  'order_tracking',
  'product_detail',
  'product_reviews',
  'vendor_profile',
]);

export function isCustomerEcommerceScreen(screen: string): boolean {
  return CUSTOMER_ECOMMERCE_SPA_SCREENS.has(screen);
}
