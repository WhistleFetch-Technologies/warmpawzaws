/**
 * Walk-in geographic radius — independent of Marketplace discovery_radius_km.
 * Product value is configuration, not a hardcoded marketplace default.
 *
 * Resolution: query maxDistance / maxDistanceKm / radiusKm, then env
 * WALK_IN_DISCOVERY_RADIUS_KM. Unconfigured → no cap (radiusKm null).
 */

export const WALK_IN_RADIUS_ENV_KEY = 'WALK_IN_DISCOVERY_RADIUS_KM';

export type WalkInRadiusResolution = {
  radiusKm: number | null;
  source: 'query' | 'env' | 'unconfigured';
};

function parsePositiveKm(raw: string | undefined | null): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveWalkInDiscoveryRadiusKm(opts: {
  queryRadiusKm?: string | null;
  queryMaxDistance?: string | null;
  queryMaxDistanceKm?: string | null;
  envValue?: string | null;
}): WalkInRadiusResolution {
  const fromQuery =
    parsePositiveKm(opts.queryRadiusKm) ??
    parsePositiveKm(opts.queryMaxDistance) ??
    parsePositiveKm(opts.queryMaxDistanceKm);
  if (fromQuery != null) {
    return { radiusKm: fromQuery, source: 'query' };
  }

  const fromEnv = parsePositiveKm(opts.envValue);
  if (fromEnv != null) {
    return { radiusKm: fromEnv, source: 'env' };
  }

  return { radiusKm: null, source: 'unconfigured' };
}

export function resolveWalkInDiscoveryRadiusFromEnvAndQuery(query: {
  radiusKm?: string | null;
  maxDistance?: string | null;
  maxDistanceKm?: string | null;
}): WalkInRadiusResolution {
  return resolveWalkInDiscoveryRadiusKm({
    queryRadiusKm: query.radiusKm,
    queryMaxDistance: query.maxDistance,
    queryMaxDistanceKm: query.maxDistanceKm,
    envValue: process.env[WALK_IN_RADIUS_ENV_KEY],
  });
}
