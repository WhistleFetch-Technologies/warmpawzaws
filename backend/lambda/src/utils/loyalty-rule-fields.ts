/**
 * Admin loyalty UI persists `min_points_to_redeem`; older rows / migrations used `min_redemption_points`.
 * Prefer the admin field when present.
 */
export function resolveMinRedemptionPointsFromRuleRow(rule: Record<string, unknown> | null | undefined): number {
  if (!rule || typeof rule !== 'object') return NaN;
  const r = rule as Record<string, any>;
  const raw = r.min_points_to_redeem ?? r.min_redemption_points;
  return parseInt(String(raw ?? ''), 10);
}
