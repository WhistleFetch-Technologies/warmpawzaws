/**
 * Vendor↔customer distance resolver:
 *   1. Both sides have lat/lng → exact Haversine km
 *   2. Either side missing coords but has pincode → geocode pincode centroid, then Haversine (marked approximate)
 *
 * All distances are returned as km (float). Formatting to integers or "m" is done by callers.
 */

import { geocodeIndiaPincode } from './geocode';

/** Haversine great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toFloat(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function normalizePin(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length === 6 ? d : null;
}

/** Format km value for display on vendor cards (integer km, whole metres under 1 km). */
export function formatDistanceKm(km: number, approximate: boolean): string {
  const suffix = approximate ? ' (approx.)' : '';
  if (km < 1) return `${Math.round(km * 1000)} m away${suffix}`;
  return `${Math.round(km)} km away${suffix}`;
}

export interface DistanceResult {
  km: number;
  approximate: boolean;
  distanceText: string;
}

/**
 * Per-request resolver.
 * Construct once with the customer's reference point, then call resolve() for each vendor.
 * Pincode geocode results are cached within the instance to avoid duplicate API calls.
 */
export class DistanceResolver {
  private readonly pincodeCache = new Map<string, Promise<{ lat: number; lng: number } | null>>();

  constructor(
    private readonly customerLat: number | null,
    private readonly customerLng: number | null,
    /** true when customer coords came from pincode centroid, not a saved pin */
    private readonly customerApproximate: boolean = false
  ) {}

  async resolve(vendor: {
    latitude?: unknown;
    longitude?: unknown;
    pincode?: unknown;
  }): Promise<DistanceResult | null> {
    if (
      this.customerLat == null ||
      this.customerLng == null ||
      !Number.isFinite(this.customerLat) ||
      !Number.isFinite(this.customerLng)
    ) {
      return null;
    }

    // --- Tier 1: vendor has explicit coordinates ---
    const vLat = toFloat(vendor.latitude);
    const vLng = toFloat(vendor.longitude);
    if (vLat != null && vLng != null) {
      const km = haversineKm(this.customerLat, this.customerLng, vLat, vLng);
      const approximate = this.customerApproximate;
      return { km, approximate, distanceText: formatDistanceKm(km, approximate) };
    }

    // --- Tier 2: vendor has pincode → geocode centroid ---
    const pin = normalizePin(vendor.pincode);
    if (!pin) return null;

    let pending = this.pincodeCache.get(pin);
    if (!pending) {
      pending = geocodeIndiaPincode(pin).then((r) =>
        r ? { lat: r.latitude, lng: r.longitude } : null
      );
      this.pincodeCache.set(pin, pending);
    }

    const pt = await pending;
    if (!pt) return null;

    const km = haversineKm(this.customerLat, this.customerLng, pt.lat, pt.lng);
    return { km, approximate: true, distanceText: formatDistanceKm(km, true) };
  }
}
