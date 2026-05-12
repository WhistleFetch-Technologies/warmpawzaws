/**
 * Customer marketplace visibility. When disabled, home keeps "coming soon" for shop tiles;
 * when enabled, home loads ecommerce categories and opens Shop with real category UUIDs.
 *
 * Customer ecommerce is currently disabled regardless of build/runtime flags.
 * Re-enable here when the customer marketplace is ready to launch again.
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

export function isCustomerEcommerceEnabled(): boolean {
  // Temporarily disabled on the customer side. Keep admin/vendor ecommerce available.
  return false;
}
