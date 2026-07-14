import type { ListingOwnership, ListingOwnershipScope, TargetOption } from './types';

/** Parse products.listing_ownership (DB + bulk upload aliases) into canonical values. */
export function parseListingOwnership(raw: unknown): ListingOwnership | null {
  if (raw === 'own_brand' || raw === 'third_party') return raw;
  if (raw == null) return null;
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized) return null;
  if (
    normalized === 'own' ||
    normalized === 'own brand' ||
    normalized === 'ownbrand' ||
    normalized === 'owned' ||
    normalized === 'self' ||
    normalized === 'my brand'
  ) {
    return 'own_brand';
  }
  if (
    normalized === 'third party' ||
    normalized === 'thirdparty' ||
    normalized === '3rd party' ||
    normalized === '3rdparty' ||
    normalized === 'third' ||
    normalized === 'other'
  ) {
    return 'third_party';
  }
  return null;
}

export function parseListingOwnershipFromProductRow(
  row: Record<string, unknown>
): ListingOwnership | null {
  return parseListingOwnership(row.listing_ownership ?? row.listingOwnership);
}

export function filterByListingOwnership(
  items: TargetOption[],
  scope: ListingOwnershipScope
): TargetOption[] {
  if (scope === 'all') return items;
  return items.filter((o) => parseListingOwnership(o.listingOwnership) === scope);
}
