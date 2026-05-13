/**
 * Customer marketplace (shop, cart tab, wishlist, checkout) visibility.
 *
 * **Currently disabled** regardless of `NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED` or
 * `window.__WARMPAWZ_RUNTIME_CONFIG__.customerEcommerceEnabled` — UI shows “Coming soon” / “Soon”.
 * Re-enable by restoring env + runtime-aware logic when launching customer commerce again.
 */

export function isCustomerEcommerceEnabled(): boolean {
  return false;
}
