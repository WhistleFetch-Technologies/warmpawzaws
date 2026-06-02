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

/** When false, meal plan browse/checkout and meal order tracking show Coming Soon. */
export function isCustomerMealPlansEnabled(): boolean {
  const rc = getRuntimeConfig().customerMealPlansEnabled;
  if (typeof rc === 'boolean') return rc;

  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED : undefined
  );
  if (explicit !== null) return explicit;

  return true;
}
