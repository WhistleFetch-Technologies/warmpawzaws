/**
 * Customer marketplace visibility. When disabled, home keeps "coming soon" for shop tiles;
 * when enabled, home loads ecommerce categories and opens Shop with real category UUIDs.
 *
 * Precedence (client): `window.__WARMPAWZ_RUNTIME_CONFIG__.customerEcommerceEnabled` when set;
 * otherwise `NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED` (defaults to on when unset — see layout + deploy scripts).
 */

export type CustomerWarmpawzRuntimeConfig = {
  apiBaseUrl?: string;
  uatMode?: boolean;
  environment?: string;
  customerEcommerceEnabled?: boolean;
};

declare global {
  interface Window {
    __WARMPAWZ_RUNTIME_CONFIG__?: CustomerWarmpawzRuntimeConfig;
  }
}

function parseCustomerEcommerceEnv(): boolean {
  const raw = (process.env.NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED ?? 'true').toLowerCase();
  return raw === 'true' || raw === '1';
}

export function isCustomerEcommerceEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const rtc = window.__WARMPAWZ_RUNTIME_CONFIG__;
    if (rtc && typeof rtc.customerEcommerceEnabled === 'boolean') {
      return rtc.customerEcommerceEnabled;
    }
  }
  return parseCustomerEcommerceEnv();
}
