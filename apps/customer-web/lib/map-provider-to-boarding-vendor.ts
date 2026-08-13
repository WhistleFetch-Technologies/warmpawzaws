/**
 * Maps UniversalServiceProviderList provider rows to BoardingListVendor
 * for reuse of BoardingVendorExpandableCard in vet home/tele listings.
 */

import { pickProviderDistanceKm } from '@/lib/distance-display';
import { formatDistanceDisplay } from '@/lib/distance-display';
import {
  planRowsFromDiscoveryServices,
  type BoardingListVendor,
  type BoardingPlanRow,
} from '@/lib/boarding-vendor-discovery-map';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';

export interface UniversalListProviderLike {
  providerId: string;
  vendorId?: string;
  name: string;
  photo?: string;
  address?: string;
  city?: string;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  role?: string;
  roleDisplayName?: string;
  roleName?: string;
  nextAvailableSlot?: string;
  services?: unknown[];
  needsServiceFetch?: boolean;
  raw?: Record<string, unknown>;
}

export function mapProviderToBoardingListVendor(
  provider: UniversalListProviderLike,
  planRowsOverride?: BoardingPlanRow[]
): BoardingListVendor {
  const id = String(provider.vendorId || provider.providerId).trim();
  const rawBase = (provider.raw ?? {}) as Record<string, unknown>;
  const raw: Record<string, unknown> = {
    ...rawBase,
    vendorId: id,
    roleDisplayName: provider.roleDisplayName || provider.roleName || provider.role || rawBase.roleDisplayName,
    roleName: provider.roleName || provider.role || rawBase.roleName,
    nextAvailableSlot: provider.nextAvailableSlot ?? rawBase.nextAvailableSlot,
    next_available_slot: provider.nextAvailableSlot ?? rawBase.next_available_slot,
    distanceKm: provider.distance ?? rawBase.distanceKm ?? rawBase.distance,
    isVerified: provider.isVerified ?? rawBase.isVerified,
  };

  const planRows =
    planRowsOverride ??
    planRowsFromDiscoveryServices(
      Array.isArray(provider.services) ? provider.services : undefined
    );

  const distKm =
    pickProviderDistanceKm(raw) ??
    (provider.distance != null && Number.isFinite(Number(provider.distance))
      ? Number(provider.distance)
      : null);

  const address =
    (typeof provider.address === 'string' && provider.address.trim()
      ? provider.address.trim()
      : '') ||
    (typeof provider.city === 'string' && provider.city.trim()
      ? provider.city.trim()
      : '') ||
    'Location on booking';

  const nextSlot = resolveNextAvailableLabel(raw);
  const timing = nextSlot ? `Next: ${nextSlot}` : 'Check availability';

  return {
    id,
    name: provider.name,
    address,
    rating: provider.rating,
    review_count: provider.reviewCount,
    distance: formatDistanceDisplay({ distanceKm: distKm, distance: distKm }) ?? null,
    distanceKm: distKm,
    timing,
    services: [],
    price_label: '',
    photo: provider.photo,
    raw,
    planRows,
    needsServiceFetch: provider.needsServiceFetch ?? planRows.length === 0,
    isVerified: provider.isVerified,
  };
}
