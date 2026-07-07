/**
 * Customer marketplace (shop, cart, wishlist, orders) — live in all environments.
 */

export function isCustomerEcommerceEnabled(): boolean {
  return true;
}

/** Legacy toast copy — guards remain for optional kill-switch if flag logic returns. */
export const CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE = 'Shop is coming soon.';

/** SPA screens owned by the marketplace (CustomerHomeWrapper). */
export const CUSTOMER_ECOMMERCE_SPA_SCREENS = new Set([
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
