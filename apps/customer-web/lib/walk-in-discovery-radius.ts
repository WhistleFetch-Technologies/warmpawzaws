/**
 * Optional client tighten only. Backend owns Walk-in 50 km / vendor radius rules.
 * Do not send Marketplace 10/50 defaults as the discovery radius.
 */
export const WALK_IN_RADIUS_PUBLIC_ENV_KEY = 'NEXT_PUBLIC_WALK_IN_DISCOVERY_RADIUS_KM';

function parsePositiveKm(raw: string | undefined | null): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readWalkInDiscoveryRadiusKm(
  envValue: string | undefined = process.env.NEXT_PUBLIC_WALK_IN_DISCOVERY_RADIUS_KM
): number | null {
  return parsePositiveKm(envValue);
}
