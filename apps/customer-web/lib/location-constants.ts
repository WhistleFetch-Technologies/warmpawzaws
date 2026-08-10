/**
 * Foreground location refresh thresholds (plan §7.3).
 * Configurable via NEXT_PUBLIC_* overrides when needed.
 */

function intEnv(name: string, fallback: number): number {
  if (typeof process === 'undefined') return fallback;
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Refresh discovery-relevant location after ~500 m movement */
export const LOCATION_MOVE_REFRESH_M = intEnv('NEXT_PUBLIC_LOCATION_MOVE_REFRESH_M', 500);

/** Active-session freshness window (~10 min) */
export const LOCATION_STALE_MS = intEnv('NEXT_PUBLIC_LOCATION_STALE_MS', 10 * 60 * 1000);

/** Debounce burst GPS updates */
export const LOCATION_REFRESH_DEBOUNCE_MS = intEnv('NEXT_PUBLIC_LOCATION_REFRESH_DEBOUNCE_MS', 30_000);

/** Ignore poor accuracy fixes for auto-refresh */
export const LOCATION_MAX_ACCURACY_M = intEnv('NEXT_PUBLIC_LOCATION_MAX_ACCURACY_M', 150);

export type LocationSource = 'gps' | 'manual_pincode' | 'manual_city' | 'cached' | 'profile' | 'unknown';

export type LocationPermissionState =
  | 'unknown'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unavailable';

export type LocationFreshness = 'fresh' | 'stale' | 'unknown';
