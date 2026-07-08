/**
 * Customer marketplace (shop, cart, wishlist, orders).
 *
 * Toggle:
 *   • Locally — NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED=true|false in .env.local
 *   • Deployed — same build env, or runtime-config `customerEcommerceEnabled`
 *   • Default — on unless NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED=false or runtime override
 */

type RuntimeConfig = {
  customerEcommerceEnabled?: boolean;
  environment?: string;
};

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: RuntimeConfig }).__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

function parseExplicitEnv(raw: string | undefined): boolean | null {
  if (raw === undefined || raw === '') return null;
  const v = raw.toLowerCase().trim();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
}

/** When false, shop/cart/checkout/wishlist/orders show Coming Soon. */
export function isCustomerEcommerceEnabled(): boolean {
  const rc = getRuntimeConfig();
  if (typeof rc.customerEcommerceEnabled === 'boolean') return rc.customerEcommerceEnabled;

  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED : undefined
  );
  if (explicit !== null) return explicit;

  // Fail-closed on production: deployed runtime-config often omits the key and would
  // otherwise fall through to default true (shop stays live after a prod deploy).
  if (rc.environment === 'production') return false;

  return true;
}

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
