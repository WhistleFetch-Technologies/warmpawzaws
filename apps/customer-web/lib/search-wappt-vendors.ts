/**
 * WAPPT discovery parity for /search — same vendor source as Services hubs
 * (GET /customer/warmpawz-appointments/discovery/by-category).
 */

import { apiClient } from '@/lib/api-client';
import { applyWapptHubDiscoveryToProviders } from '@/lib/filter-hub-services';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import {
  getWapptDiscoveryCategory,
  getWapptHubConfig,
  normalizeWapptHubCategory,
} from '@/lib/wappt-hub-registry';
import { discoveryNextCursor, discoveryVendorList } from '@/lib/discovery-list';
import { inferHubSlugFromSearchQuery } from '@/lib/search-hub-category-filter';

/** Hubs where search chip emptiness was reported (vet / groom / train). */
export const SEARCH_WAPPT_PARITY_HUBS = [
  'vet',
  'grooming',
  'training',
  'behaviorist',
  'boarding',
  'walker',
  'sitting',
  'nutrition',
] as const;

/**
 * Whether search should load WAPPT discovery for a hub chip.
 * Gated strictly on Commerce Switch — marketplace must not merge WAPPT vendors.
 */
export function canLoadWapptSearchHub(category: string): boolean {
  const hub = normalizeWapptHubCategory(category);
  if (!hub || !getWapptHubConfig(hub)) return false;
  return isWarmpawzAppointmentsHubEnabled(hub);
}

export type SearchWapptVendorRow = {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  city: string;
  addressDisplay: string;
  imageUrl?: string;
  distanceKm: number | null;
  roleDisplayName?: string;
  preferredServiceStyle?: string;
  serviceStyle?: string;
  nextAvailableSlot?: string;
};

function mapDiscoveryRowToSearchWapptVendor(
  row: Record<string, unknown>,
  hubSlug: string
): SearchWapptVendorRow | null {
  const id = String(row.vendorId ?? row.id ?? '').trim();
  if (!id) return null;
  const name =
    String(row.name ?? row.businessName ?? row.business_name ?? '').trim() || 'Provider';
  const city = String(row.city ?? '').trim();
  const shortAddress =
    String(row.shortAddress ?? '').trim() ||
    String(row.address ?? '').trim() ||
    city ||
    'Location on booking';
  const nextAvailableSlot =
    String(row.nextAvailableSlot ?? row.availabilityText ?? '').trim() || undefined;
  const distRaw = row.distanceKm ?? row.distance;
  const distanceKm =
    distRaw != null && Number.isFinite(Number(distRaw)) ? Number(distRaw) : null;
  const preferredServiceStyle =
    String(row.preferredServiceStyle ?? row.preferred_service_style ?? '').trim() || undefined;
  const serviceStyle =
    String(row.serviceStyle ?? row.service_style ?? '').trim() || undefined;
  return {
    id,
    name,
    category: hubSlug,
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.reviewCount ?? row.review_count) || 0,
    city,
    addressDisplay: shortAddress,
    imageUrl: String(row.photoUrl ?? row.photo ?? row.profileImage ?? '').trim() || undefined,
    distanceKm,
    roleDisplayName: String(row.roleDisplayName ?? row.roleName ?? '').trim() || undefined,
    preferredServiceStyle,
    serviceStyle,
    nextAvailableSlot,
  };
}

async function fetchWapptDiscoveryRows(hubSlug: string, max = 50): Promise<Record<string, unknown>[]> {
  const wapptCategory = getWapptDiscoveryCategory(hubSlug);
  const collected: Record<string, unknown>[] = [];
  let cursor: string | null = null;

  while (collected.length < max) {
    const qs = new URLSearchParams({
      category: wapptCategory,
      serviceStyle: 'all',
      limit: String(Math.min(20, max - collected.length)),
    });
    if (cursor) qs.set('cursor', cursor);

    const res = await apiClient
      .get(`/customer/warmpawz-appointments/discovery/by-category?${qs.toString()}`)
      .catch(() => null);
    if (!res) break;

    const batch = discoveryVendorList(res);
    if (!batch.length) break;
    collected.push(...batch);
    cursor = discoveryNextCursor(res);
    if (!cursor) break;
  }

  return applyWapptHubDiscoveryToProviders(collected, wapptCategory);
}

/** Which hub slugs should load WAPPT vendors for the current search context. */
export function resolveWapptHubsForSearch(opts: {
  category?: string;
  query?: string;
  browseAll?: boolean;
}): string[] {
  const category = (opts.category || '').trim().toLowerCase();
  if (category && canLoadWapptSearchHub(category)) {
    const hub = normalizeWapptHubCategory(category);
    return hub ? [hub] : [category];
  }

  const inferred = inferHubSlugFromSearchQuery(opts.query || '');
  if (inferred && canLoadWapptSearchHub(inferred)) {
    const hub = normalizeWapptHubCategory(inferred);
    return hub ? [hub] : [inferred];
  }

  if (opts.browseAll) {
    return SEARCH_WAPPT_PARITY_HUBS.filter((hub) => canLoadWapptSearchHub(hub));
  }

  return [];
}

/** Fetch WAPPT vendors for a hub (Services parity). Optional keyword filters name/city client-side. */
export async function fetchWapptSearchVendorResults(
  hubSlug: string,
  opts?: { keyword?: string; limit?: number }
): Promise<SearchWapptVendorRow[]> {
  if (!canLoadWapptSearchHub(hubSlug)) return [];

  const rows = await fetchWapptDiscoveryRows(hubSlug, opts?.limit ?? 50);
  const qLower = (opts?.keyword || '').trim().toLowerCase();

  const mapped: SearchWapptVendorRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const card = mapDiscoveryRowToSearchWapptVendor(row, hubSlug);
    if (!card || seen.has(card.id)) continue;
    if (qLower) {
      const hay = `${card.name} ${card.city} ${card.addressDisplay}`.toLowerCase();
      if (!hay.includes(qLower)) continue;
    }
    seen.add(card.id);
    mapped.push(card);
  }
  return mapped;
}

/** Merge WAPPT vendor rows ahead of marketplace rows; dedupe by vendor id. */
export function mergeWapptSearchVendorRows<T extends { id: string; type?: string }>(
  marketplaceRows: T[],
  wapptRows: SearchWapptVendorRow[],
  toMarketplaceRow: (row: SearchWapptVendorRow) => T
): T[] {
  if (!wapptRows.length) return marketplaceRows;
  const seen = new Set(
    marketplaceRows.filter((r) => r.type === 'vendor' || !r.type).map((r) => r.id)
  );
  const prepend: T[] = [];
  for (const w of wapptRows) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    prepend.push(toMarketplaceRow(w));
  }
  return [...prepend, ...marketplaceRows];
}
