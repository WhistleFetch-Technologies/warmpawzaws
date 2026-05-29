/**
 * Customer meal plans + meal order tracking (browse, checkout, /orders/meal-plans, /track/:id).
 *
 * Toggle:
 *   • Locally — NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED=true|false in .env.local
 *   • Deployed — same build env, or runtime-config `customerMealPlansEnabled`
 *   • Default — on unless NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED=false or runtime override
 */

type RuntimeConfig = {
  customerMealPlansEnabled?: boolean;
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

function isProductionEnvironment(): boolean {
  const cfg = getRuntimeConfig();
  if (cfg.environment === 'production') return true;
  if (cfg.environment === 'development') return false;

  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENVIRONMENT) {
    return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  }
  // `npm run build` sets NODE_ENV=production even for dev exports. Without an explicit
  // NEXT_PUBLIC_ENVIRONMENT in the client bundle, do not treat the host as production.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    const pubEnv = process.env.NEXT_PUBLIC_ENVIRONMENT;
    if (pubEnv === 'development') return false;
    if (pubEnv === 'production') return true;
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (
      hostname === 'd2aoyjj8ine0wk.cloudfront.net' ||
      hostname.startsWith('dev.') ||
      hostname.includes('.dev.warmpawz.com')
    ) {
      return false;
    }
    if (
      hostname.includes('cloudfront.net') ||
      hostname === 'customer.warmpawz.com' ||
      hostname === 'www.warmpawz.com' ||
      hostname === 'warmpawz.com'
    ) {
      return true;
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
      return false;
    }
  }

  return true;
}

/** When false, meal plan browse/checkout and meal order tracking show Coming Soon (prod default). */
export function isCustomerMealPlansEnabled(): boolean {
  const rc = getRuntimeConfig().customerMealPlansEnabled;
  if (typeof rc === 'boolean') return rc;

  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED : undefined
  );
  if (explicit !== null) return explicit;

  return !isProductionEnvironment();
}
