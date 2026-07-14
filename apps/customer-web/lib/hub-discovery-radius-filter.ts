import { pickProviderDistanceKm } from '@/lib/distance-display';

/** Mirrors backend default `discovery_radius_km` for at_center hubs. */
export const HUB_DISCOVERY_AT_CENTER_RADIUS_KM = 50;

/** Platform fallback for at_home when vendor has no service_radius. */
export const HUB_DISCOVERY_AT_HOME_PLATFORM_RADIUS_KM = 10;

export type HubDiscoveryRadiusStyle = 'at_center' | 'at_home' | 'tele';

function parsePositiveKm(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function vendorHomeCapKm(row: Record<string, unknown>): number {
  const cap =
    parsePositiveKm(row.service_radius) ??
    parsePositiveKm(row.serviceRadius) ??
    parsePositiveKm(row.service_distance_km) ??
    parsePositiveKm(row.serviceDistanceKm);
  return cap ?? HUB_DISCOVERY_AT_HOME_PLATFORM_RADIUS_KM;
}

function effectiveCapKm(
  style: HubDiscoveryRadiusStyle,
  row: Record<string, unknown>,
  maxDistanceKm?: number | null
): number | null {
  if (style === 'tele') return null;
  if (style === 'at_home') {
    const vendorCap = vendorHomeCapKm(row);
    if (maxDistanceKm != null && Number.isFinite(maxDistanceKm)) {
      return Math.min(maxDistanceKm, vendorCap);
    }
    return vendorCap;
  }
  if (maxDistanceKm != null && Number.isFinite(maxDistanceKm)) return maxDistanceKm;
  return HUB_DISCOVERY_AT_CENTER_RADIUS_KM;
}

/**
 * Client-side defense: drop providers outside discover-services radius when coords are known.
 * Tele is nationwide. Pet sitting keeps rows with unknown distance (backend sittingRelaxed parity).
 */
export function filterHubDiscoveryRowsByRadius<T extends object>(
  rows: T[],
  opts: {
    serviceStyle: HubDiscoveryRadiusStyle;
    latitude?: string;
    longitude?: string;
    /** Pet sitting: allow unknown distance when strict radius would hide everyone. */
    sittingRelaxed?: boolean;
    maxDistanceKm?: number | null;
  }
): T[] {
  if (opts.serviceStyle === 'tele') return rows;
  if (!opts.latitude?.trim() || !opts.longitude?.trim()) return rows;

  const filtered = rows.filter((row) => {
    const asRecord = row as Record<string, unknown>;
    const km = pickProviderDistanceKm(asRecord);
    const cap = effectiveCapKm(opts.serviceStyle, asRecord, opts.maxDistanceKm);
    if (cap == null) return true;
    if (km == null) {
      if (opts.serviceStyle === 'at_home') return true;
      return opts.sittingRelaxed === true;
    }
    return km <= cap;
  });

  if (filtered.length > 0) return filtered;
  if (opts.sittingRelaxed) return rows;
  return filtered;
}
