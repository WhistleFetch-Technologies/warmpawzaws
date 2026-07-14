/**
 * Shared list-card projection for GET /customer/discover-services and
 * GET /customer/services/by-style — cards only (no services[] / gallery).
 */
import type { DistanceResolver } from '../lib/utils/vendor-customer-distance';
import { vendorRowIsOnline } from '../lib/search-discovery-parity';
import { getVendorListingPhotoUrl } from './vendor-listing-photo';
import { mapWithConcurrency } from '../services/image';

export const DISCOVERY_LIST_ENRICH_CONCURRENCY = 6;
/** Cap list size for TTI / cost (caller may already clamp via rules). */
export const DISCOVERY_LIST_DEFAULT_MAX = 20;
/** Soft budget for next-available slot on list cards. */
export const DISCOVERY_LIST_SLOT_TIMEOUT_MS = 800;

export type DiscoveryListSlotFn = (
  vendorId: string,
  phone: string,
  acceptableStyles: string[]
) => Promise<{ date?: string; time?: string; display?: string } | null>;

/** Slim row for rare fullEnrich=true embeds (not used on default list). */
export function slimDiscoveryListService(s: Record<string, unknown>): Record<string, unknown> {
  return {
    id: s.id,
    serviceId: s.serviceId ?? s.service_id,
    name: s.name ?? s.serviceName ?? s.service_name,
    price: s.price,
    duration: s.duration,
    category: s.category ?? s.categoryName ?? s.category_name,
    serviceStyle: s.serviceStyle ?? s.service_style ?? null,
    isPackage: !!s.isPackage,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type EnrichDiscoveryListVendorOpts = {
  vendor: any;
  /** Used for eligibility + priceMin/Max/serviceCount; not serialized by default */
  services: any[];
  acceptableStyles: string[];
  distResolver: DistanceResolver;
  getNextAvailableSlot: DiscoveryListSlotFn;
  defaultAvailabilityDisplay: string;
  problemTitle?: string;
  specializations?: string[];
  /** Opt-in: attach slim services[] (default false — cards only). */
  fullServices?: boolean;
  /** When false, skip slot scan. Default true with soft timeout. */
  includeAvailability?: boolean;
};

/**
 * List card for a vendor. Returns null when zero matching services.
 */
export async function enrichDiscoveryListVendor(
  opts: EnrichDiscoveryListVendorOpts
): Promise<Record<string, unknown> | null> {
  const { vendor, acceptableStyles, distResolver, getNextAvailableSlot } = opts;
  const services = Array.isArray(opts.services) ? opts.services : [];
  if (services.length === 0) return null;

  let distResult: { km?: number | null; distanceText?: string | null } | null = null;
  try {
    distResult = await distResolver.resolve({
      id: vendor.vendor_id,
      latitude: vendor.latitude,
      longitude: vendor.longitude,
      pincode: vendor.pincode,
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
    });
  } catch {
    distResult = null;
  }

  let nextAvailable: { date?: string; time?: string; display?: string } = {
    date: '',
    time: '',
    display: opts.defaultAvailabilityDisplay,
  };
  if (opts.includeAvailability !== false) {
    try {
      const slot = await withTimeout(
        getNextAvailableSlot(vendor.vendor_id, vendor.phone || '', acceptableStyles),
        DISCOVERY_LIST_SLOT_TIMEOUT_MS
      );
      if (slot && (slot.display || slot.date || slot.time)) {
        nextAvailable = {
          date: slot.date || '',
          time: slot.time || '',
          display: slot.display || opts.defaultAvailabilityDisplay,
        };
      }
    } catch {
      /* non-fatal */
    }
  }

  let photoUrl: string | null = null;
  try {
    photoUrl = await getVendorListingPhotoUrl(vendor);
  } catch {
    photoUrl = null;
  }

  const prices = services
    .map((s: any) => Number(s.price))
    .filter((p: number) => Number.isFinite(p) && p > 0);
  const priceMin = prices.length > 0 ? Math.min(...prices) : undefined;
  const priceMax = prices.length > 0 ? Math.max(...prices) : undefined;

  const specializations = opts.specializations?.length ? opts.specializations : [];

  const card: Record<string, unknown> = {
    id: vendor.vendor_id,
    vendorId: vendor.vendor_id,
    name: vendor.business_name || vendor.owner_name,
    phone: vendor.phone,
    address: vendor.address,
    city: vendor.city,
    roleDisplayName: vendor.role_display_name || vendor.role_name || '',
    roleName: vendor.role_name || '',
    vendorType: vendor.vendor_type === 'solo' ? 'solo' : 'business',
    photoUrl,
    rating: parseFloat(vendor.avg_rating || '0'),
    reviewCount: parseInt(vendor.review_count || '0', 10),
    distanceKm: distResult?.km ?? null,
    distanceText: distResult?.distanceText ?? null,
    distance: distResult?.km ?? null,
    nextAvailable,
    isVerified: true,
    isOnline: vendorRowIsOnline(vendor.is_online),
    priceMin: priceMin && priceMin > 0 ? priceMin : undefined,
    priceMax: priceMax && priceMax > 0 ? priceMax : undefined,
    serviceCount: services.length,
    specializations: specializations.length ? specializations : undefined,
    bestForProblem: opts.problemTitle || undefined,
  };

  if (opts.fullServices) {
    card.services = services.map((s) => slimDiscoveryListService(s as Record<string, unknown>));
  }

  return card;
}

export async function enrichDiscoveryListVendorsConcurrent<TRow extends { vendor_id: string }>(
  rows: TRow[],
  enrichOne: (row: TRow) => Promise<Record<string, unknown> | null>,
  concurrency = DISCOVERY_LIST_ENRICH_CONCURRENCY
): Promise<Record<string, unknown>[]> {
  const seen = new Set<string>();
  const unique: TRow[] = [];
  for (const row of rows) {
    const id = String(row.vendor_id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(row);
  }

  const enriched = await mapWithConcurrency(unique, concurrency, async (row) => {
    try {
      return await enrichOne(row);
    } catch (err: any) {
      console.warn(
        '[discovery-list-enrich] vendor enrich failed:',
        String(row.vendor_id).substring(0, 8),
        err?.message || err
      );
      return null;
    }
  });

  return enriched.filter((p): p is Record<string, unknown> => p != null);
}
