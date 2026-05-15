/**
 * Vendor↔customer distance resolver:
 *   1. Both sides have lat/lng → exact Haversine km
 *   2. Vendor missing lat/lng but has full address → Google address geocode, then Haversine
 *   3. Either side missing coords but has pincode → geocode pincode centroid, then Haversine (marked approximate)
 *
 * All distances are returned as km (float). Formatting to integers or "m" is done by callers.
 */

import { geocodeAddress, geocodeIndiaPincode } from './geocode';
import { update } from '../../database/rds-connection';

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

function normalizeAddressKey(parts: Array<unknown>): string {
  return parts
    .map((p) => String(p ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');
}

/**
 * Per-request resolver.
 * Construct once with the customer's reference point, then call resolve() for each vendor.
 * Pincode geocode results are cached within the instance to avoid duplicate API calls.
 *
 * Tiering:
 *   1. Vendor has explicit lat/lng → exact Haversine.
 *   2. Vendor has full address (line + city/state) → Google Geocoding (cached).
 *      Optionally persists the resolved coords back to the vendor row so
 *      subsequent requests skip the API call (when persistVendorCoords=true).
 *   3. Vendor has pincode → centroid geocode (cached).
 */
export class DistanceResolver {
  private readonly pincodeCache = new Map<string, Promise<{ lat: number; lng: number } | null>>();
  private readonly addressCache = new Map<string, Promise<{ lat: number; lng: number } | null>>();
  private readonly persistedVendors = new Set<string>();

  constructor(
    private readonly customerLat: number | null,
    private readonly customerLng: number | null,
    /** true when customer coords came from pincode centroid, not a saved pin */
    private readonly customerApproximate: boolean = false,
    /** When true (default): backfill resolved vendor coords into vendors row. */
    private readonly persistVendorCoords: boolean = true
  ) {}

  async resolve(vendor: {
    id?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    pincode?: unknown;
    address?: unknown;
    city?: unknown;
    state?: unknown;
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

    // --- Tier 2: vendor has a usable street address → geocode it (and persist) ---
    const addrLine = String(vendor.address ?? '').trim();
    const cityLine = String(vendor.city ?? '').trim();
    const stateLine = String(vendor.state ?? '').trim();
    const pinDigits = normalizePin(vendor.pincode);
    const hasUsableAddress = (addrLine.length >= 4 && (cityLine.length > 0 || pinDigits)) || cityLine.length >= 3;
    if (hasUsableAddress) {
      const fullAddress = [addrLine, cityLine, stateLine, pinDigits || '', 'India']
        .map((p) => p.trim())
        .filter(Boolean)
        .join(', ');
      const cacheKey = normalizeAddressKey([addrLine, cityLine, stateLine, pinDigits]);
      let pending = this.addressCache.get(cacheKey);
      if (!pending) {
        pending = geocodeAddress(fullAddress).then((r) =>
          r ? { lat: r.latitude, lng: r.longitude } : null
        );
        this.addressCache.set(cacheKey, pending);
      }
      const pt = await pending;
      if (pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
        await this.maybePersistVendorCoords(vendor, pt.lat, pt.lng);
        const km = haversineKm(this.customerLat, this.customerLng, pt.lat, pt.lng);
        return { km, approximate: true, distanceText: formatDistanceKm(km, true) };
      }
    }

    // --- Tier 3: vendor has pincode → geocode centroid ---
    if (!pinDigits) return null;

    let pendingPin = this.pincodeCache.get(pinDigits);
    if (!pendingPin) {
      pendingPin = geocodeIndiaPincode(pinDigits).then((r) =>
        r ? { lat: r.latitude, lng: r.longitude } : null
      );
      this.pincodeCache.set(pinDigits, pendingPin);
    }

    const pt = await pendingPin;
    if (!pt) return null;

    await this.maybePersistVendorCoords(vendor, pt.lat, pt.lng);
    const km = haversineKm(this.customerLat, this.customerLng, pt.lat, pt.lng);
    return { km, approximate: true, distanceText: formatDistanceKm(km, true) };
  }

  /** Best-effort write-through cache so the next request skips geocoding. */
  private async maybePersistVendorCoords(
    vendor: { id?: unknown },
    lat: number,
    lng: number
  ): Promise<void> {
    if (!this.persistVendorCoords) return;
    const vid = vendor?.id ? String(vendor.id) : '';
    if (!vid || this.persistedVendors.has(vid)) return;
    this.persistedVendors.add(vid);
    try {
      await update(
        'vendors',
        { id: vid },
        {
          latitude: lat,
          longitude: lng,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      // Non-fatal — we still return the resolved distance for this request.
      console.warn(
        '[DistanceResolver] Could not backfill vendor coords:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
