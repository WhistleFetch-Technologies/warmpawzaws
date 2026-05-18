export function hasDistanceValue(distance: unknown): distance is number {
  return typeof distance === 'number' && Number.isFinite(distance);
}

function coerceDistanceValue(distance: unknown): number | null {
  if (hasDistanceValue(distance)) return distance;
  if (typeof distance === 'string') {
    const parsed = Number.parseFloat(distance.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatDistanceFromKm(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${Math.round(distanceKm)} km`;
}

/** Normalize distance from discovery/by-style payloads (snake_case + camelCase). */
export function pickProviderDistanceKm(item: {
  distance?: unknown;
  distanceKm?: unknown;
  distance_km?: unknown;
}): number | null {
  const raw = item.distanceKm ?? item.distance_km ?? item.distance;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatDistanceDisplay(input: {
  distanceText?: string | null;
  distance?: number | string | null;
  distanceKm?: number | string | null;
}): string | null {
  if (typeof input.distanceText === 'string' && input.distanceText.trim()) {
    return input.distanceText.trim();
  }
  const distanceKm = coerceDistanceValue(input.distanceKm);
  if (distanceKm != null) return formatDistanceFromKm(distanceKm);
  const distance = coerceDistanceValue(input.distance);
  if (distance != null) return formatDistanceFromKm(distance);
  return null;
}
