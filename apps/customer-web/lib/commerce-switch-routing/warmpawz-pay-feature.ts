/**
 * Feature gates for Warmpawz Pay customer routing.
 * Requires env flags; commerce switch active model is checked in the route adapter.
 */
export function isWarmpawzPayFeatureEnabled(): boolean {
  const enabled =
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED === 'true' ||
    process.env.WARMPAWZ_PAY_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED !== 'false';
  const apisReady =
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_CUSTOMER_APIS_DEPLOYED === 'true' ||
    process.env.WARMPAWZ_PAY_CUSTOMER_APIS_DEPLOYED === 'true' ||
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_CUSTOMER_APIS_DEPLOYED !== 'false';
  return enabled && apisReady;
}
