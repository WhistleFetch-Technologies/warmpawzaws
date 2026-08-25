/**
 * Walk-in radius config — independent of Marketplace discovery_radius_km.
 * Unset means no client-sent cap (backend may also be unconfigured).
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
