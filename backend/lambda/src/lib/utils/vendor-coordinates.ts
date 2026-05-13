/**
 * Vendor coordinate resolver.
 *
 * Customer-facing discovery requires every center / clinic to expose a
 * computed distance to the customer. Many legacy vendor rows have NULL
 * `latitude` / `longitude` — onboarding never captured a map pin and the
 * profile update flow does not geocode the entered address.
 *
 * This helper centralises three behaviours used across discovery endpoints
 * and the profile update path:
 *   1. Best-effort geocoding from full business address + city + state +
 *      pincode (Google Geocoding API).
 *   2. Pincode-centroid fallback when full-address geocoding fails (or
 *      when only the pincode is known).
 *   3. Optional persistence to the `vendors` table so the same vendor
 *      does not need to be geocoded again on the next request.
 *
 * All operations are best-effort and never throw — they simply return
 * `null` when no coordinates could be resolved (e.g. missing API key).
 */

import { update } from '../../database/rds-connection';
import { geocodeAddress, geocodeIndiaPincode } from './geocode';

export interface ResolvedVendorCoordinates {
  latitude: number;
  longitude: number;
  approximate: boolean;
  /** True when this resolver geocoded the address and persisted to DB. */
  persisted: boolean;
}

function toFiniteFloat(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function buildAddressString(vendor: {
  address?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
}): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    if (raw == null) return;
    const s = String(raw).trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(s);
  };
  push(vendor.address);
  push(vendor.city);
  push(vendor.state);
  const pinDigits = String(vendor.pincode ?? '').replace(/\D/g, '');
  if (pinDigits.length === 6) push(pinDigits);
  push('India');
  return parts.join(', ');
}

/**
 * Geocode the vendor's address (best-effort) and persist the resolved
 * coordinates to the `vendors` table when `vendorId` is provided.
 *
 * Returns `null` when no usable signal exists or when both geocode tiers
 * fail. Existing valid coordinates on the row short-circuit the call.
 */
export async function resolveVendorCoordinates(
  vendor: {
    id?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    address?: unknown;
    city?: unknown;
    state?: unknown;
    pincode?: unknown;
  },
  options?: { persist?: boolean }
): Promise<ResolvedVendorCoordinates | null> {
  const lat = toFiniteFloat(vendor?.latitude);
  const lng = toFiniteFloat(vendor?.longitude);
  if (lat != null && lng != null) {
    return { latitude: lat, longitude: lng, approximate: false, persisted: false };
  }

  const fullAddress = buildAddressString(vendor || {});
  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;
  let approximate = true;

  if (fullAddress.replace(/India/gi, '').replace(/[ ,]/g, '').length >= 4) {
    try {
      const res = await geocodeAddress(fullAddress);
      if (res && Number.isFinite(res.latitude) && Number.isFinite(res.longitude)) {
        resolvedLat = res.latitude;
        resolvedLng = res.longitude;
        approximate = false;
      }
    } catch (err) {
      console.warn(
        '[vendor-coords] Address geocode failed:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (resolvedLat == null || resolvedLng == null) {
    const pin = String(vendor?.pincode ?? '').replace(/\D/g, '');
    if (pin.length === 6) {
      try {
        const pinRes = await geocodeIndiaPincode(pin);
        if (pinRes && Number.isFinite(pinRes.latitude) && Number.isFinite(pinRes.longitude)) {
          resolvedLat = pinRes.latitude;
          resolvedLng = pinRes.longitude;
          approximate = true;
        }
      } catch (err) {
        console.warn(
          '[vendor-coords] Pincode geocode failed:',
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  if (resolvedLat == null || resolvedLng == null) return null;

  let persisted = false;
  if (options?.persist && vendor?.id) {
    try {
      await update(
        'vendors',
        { id: vendor.id },
        {
          latitude: resolvedLat,
          longitude: resolvedLng,
          updated_at: new Date().toISOString(),
        }
      );
      persisted = true;
      console.log(
        `[vendor-coords] Backfilled coordinates for vendor ${vendor.id} (approximate=${approximate})`
      );
    } catch (err) {
      console.warn(
        '[vendor-coords] Could not persist backfilled coordinates:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return { latitude: resolvedLat, longitude: resolvedLng, approximate, persisted };
}

/**
 * Same intent as resolveVendorCoordinates but optimised for discovery
 * loops: keeps a per-process cache so the same vendor isn't geocoded
 * twice within a single request even when persistence is off.
 */
export class VendorCoordinateBackfiller {
  private readonly cache = new Map<string, Promise<ResolvedVendorCoordinates | null>>();
  constructor(private readonly persist: boolean = true) {}

  async resolve(vendor: {
    id?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    address?: unknown;
    city?: unknown;
    state?: unknown;
    pincode?: unknown;
  }): Promise<ResolvedVendorCoordinates | null> {
    const id = vendor?.id ? String(vendor.id) : null;
    if (!id) {
      return resolveVendorCoordinates(vendor, { persist: false });
    }
    let pending = this.cache.get(id);
    if (!pending) {
      pending = resolveVendorCoordinates(vendor, { persist: this.persist });
      this.cache.set(id, pending);
    }
    return pending;
  }
}
