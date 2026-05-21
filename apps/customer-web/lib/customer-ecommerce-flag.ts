/**
 * Customer marketplace feature flag (shop, cart, wishlist, orders).
 *
 * Toggle on/off in one place:
 *   • Locally  — set NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED=true|false in .env.local
 *   • Deployed — set the same env var in the build environment, OR override at runtime via
 *                window.__WARMPAWZ_RUNTIME_CONFIG__.customerEcommerceEnabled (runtime-config.js)
 *   • Hard-off — replace the body with `return false;` and redeploy
 *
 * Precedence (highest → lowest):
 *   1. window.__WARMPAWZ_RUNTIME_CONFIG__.customerEcommerceEnabled  (runtime override)
 *   2. NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED                        (build-time env)
 *   3. false                                                          (default: off / coming soon)
 */

function parseExplicitEnv(raw: string | undefined): boolean | null {
  if (raw === undefined || raw === '') return null;
  const v = raw.toLowerCase().trim();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
}

export function isCustomerEcommerceEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const rc = (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: { customerEcommerceEnabled?: boolean } })
      .__WARMPAWZ_RUNTIME_CONFIG__?.customerEcommerceEnabled;
    if (typeof rc === 'boolean') return rc;
  }
  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED : undefined
  );
  if (explicit !== null) return explicit;
  return false; // default: off until launch
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
