/**
 * Feature gates for Warmpawz Pay customer routing (stub — no Pay module imports).
 * Both flags must be true before the warmpawz_pay adapter reports availability.
 */
export function isWarmpawzPayFeatureEnabled(): boolean {
  const enabled =
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED === 'true' ||
    process.env.WARMPAWZ_PAY_ENABLED === 'true';
  const apisReady =
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_CUSTOMER_APIS_DEPLOYED === 'true' ||
    process.env.WARMPAWZ_PAY_CUSTOMER_APIS_DEPLOYED === 'true';
  return enabled && apisReady;
}
