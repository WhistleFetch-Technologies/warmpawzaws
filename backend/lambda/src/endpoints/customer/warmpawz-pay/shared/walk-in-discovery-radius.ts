/**
 * Walk-in geographic eligibility — independent of Marketplace discovery.
 * Do not import getDiscoveryRules / applyDiscoveryRadiusFilter / discovery_radius_km*.
 */

export const WALK_IN_AT_CENTER_RADIUS_KM = 50;

export type WalkInRadiusSource =
  | 'walk_in_at_center_50km'
  | 'vendor_service_radius'
  | 'walk_in_mixed_style_union';

export type WalkInEffectiveRadius = {
  effectiveRadiusKm: number | null;
  radiusSource: WalkInRadiusSource | null;
  homeRadiusKm: number | null;
};

export function parsePositiveKm(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Canonical at-home coverage: vendors.service_radius then vendors.service_distance_km. */
export function resolveWalkInHomeRadiusKm(opts: {
  serviceRadius?: unknown;
  serviceDistanceKm?: unknown;
}): number | null {
  return parsePositiveKm(opts.serviceRadius) ?? parsePositiveKm(opts.serviceDistanceKm);
}

/**
 * Locked product radius.
 * Only at-center → 50.
 * Only at-home → vendor home radius, else exclude.
 * Both → max(50, homeRadius) (missing home still allows the 50 km center side).
 * No physical style / tele-only → exclude.
 */
export function resolveWalkInEffectiveRadius(opts: {
  hasAtHome: boolean;
  hasAtCenter: boolean;
  homeRadiusKm?: number | null;
}): WalkInEffectiveRadius {
  const homeRadiusKm = parsePositiveKm(opts.homeRadiusKm);

  if (opts.hasAtHome && opts.hasAtCenter) {
    return {
      homeRadiusKm,
      effectiveRadiusKm: Math.max(WALK_IN_AT_CENTER_RADIUS_KM, homeRadiusKm ?? WALK_IN_AT_CENTER_RADIUS_KM),
      radiusSource: 'walk_in_mixed_style_union',
    };
  }

  if (opts.hasAtCenter) {
    return {
      homeRadiusKm,
      effectiveRadiusKm: WALK_IN_AT_CENTER_RADIUS_KM,
      radiusSource: 'walk_in_at_center_50km',
    };
  }

  if (opts.hasAtHome) {
    return {
      homeRadiusKm,
      effectiveRadiusKm: homeRadiusKm,
      radiusSource: homeRadiusKm != null ? 'vendor_service_radius' : null,
    };
  }

  return { homeRadiusKm, effectiveRadiusKm: null, radiusSource: null };
}

/** Query radius may tighten only. It cannot expand a 50 km center / mixed product cap. */
export function applyWalkInQueryTighten(
  productRadiusKm: number,
  queryTightenKm: number | null
): number {
  const tighten = parsePositiveKm(queryTightenKm);
  if (tighten == null) return productRadiusKm;
  return Math.min(productRadiusKm, tighten);
}

export function parseWalkInQueryTightenKm(query: {
  radiusKm?: string | null;
  maxDistance?: string | null;
  maxDistanceKm?: string | null;
}): number | null {
  return (
    parsePositiveKm(query.maxDistanceKm) ??
    parsePositiveKm(query.maxDistance) ??
    parsePositiveKm(query.radiusKm)
  );
}

export const WALK_IN_AT_HOME_STYLE_SQL = `ARRAY['at_home','home_visit']::text[]`;
export const WALK_IN_AT_CENTER_STYLE_SQL = `ARRAY['at_center','at_vendor','at_clinic']::text[]`;

export function walkInHasStyleSql(styleArraySql: string): string {
  return `EXISTS (
    SELECT 1 FROM vendor_services vs
    WHERE vs.vendor_id = v.id
      AND vs.is_enabled = true
      AND vs.service_style = ANY(${styleArraySql})
  )`;
}

export function walkInHomeRadiusSql(includeServiceDistanceKm: boolean): string {
  const distanceFallback = includeServiceDistanceKm
    ? `
    WHEN CAST(v.service_distance_km AS DOUBLE PRECISION) > 0
      THEN CAST(v.service_distance_km AS DOUBLE PRECISION)`
    : '';
  return `CASE
    WHEN CAST(v.service_radius AS DOUBLE PRECISION) > 0
      THEN CAST(v.service_radius AS DOUBLE PRECISION)${distanceFallback}
    ELSE NULL
  END`;
}

export function walkInProductRadiusSql(): string {
  return `CASE
    WHEN has_at_home AND has_at_center
      THEN GREATEST(${WALK_IN_AT_CENTER_RADIUS_KM}::double precision, COALESCE(home_radius_km, ${WALK_IN_AT_CENTER_RADIUS_KM}::double precision))
    WHEN has_at_center THEN ${WALK_IN_AT_CENTER_RADIUS_KM}::double precision
    WHEN has_at_home THEN home_radius_km
    ELSE NULL
  END`;
}

export function walkInRadiusSourceSql(): string {
  return `CASE
    WHEN has_at_home AND has_at_center THEN 'walk_in_mixed_style_union'
    WHEN has_at_center THEN 'walk_in_at_center_50km'
    WHEN has_at_home AND home_radius_km IS NOT NULL THEN 'vendor_service_radius'
    ELSE NULL
  END`;
}
