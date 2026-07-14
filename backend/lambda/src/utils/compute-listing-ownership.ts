/**
 * Vendor-declared listing ownership for ecommerce commission V2.
 */

import { query } from '../database/rds-connection';

export type ListingOwnership = 'own_brand' | 'third_party';
export type ListingOwnershipSource = 'auto' | 'manual' | 'admin';

/** Promo targeting scope — default `all` keeps prior cart-wide / product-list behavior. */
export type ListingOwnershipScope = 'all' | ListingOwnership;

export function normalizeListingOwnershipScope(raw: unknown): ListingOwnershipScope {
  if (raw == null || raw === '') return 'all';
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (
    normalized === 'own' ||
    normalized === 'own brand' ||
    normalized === 'ownbrand' ||
    normalized === 'owned' ||
    normalized === 'owned products'
  ) {
    return 'own_brand';
  }
  if (
    normalized === 'third party' ||
    normalized === 'thirdparty' ||
    normalized === '3rd party' ||
    normalized === '3rdparty'
  ) {
    return 'third_party';
  }
  if (normalized === 'all' || normalized === 'both') return 'all';
  return 'all';
}

/**
 * Whether a cart/catalog line matches a promo's listing_ownership_scope.
 * Unset product ownership only matches scope `all` (fail closed for exclusive scopes).
 */
export function lineMatchesListingOwnershipScope(
  scope: unknown,
  listingOwnership: string | null | undefined
): boolean {
  const normalizedScope = normalizeListingOwnershipScope(scope);
  if (normalizedScope === 'all') return true;
  const normalizedOwnership =
    listingOwnership === 'own_brand' || listingOwnership === 'third_party'
      ? listingOwnership
      : parseListingOwnershipInput(listingOwnership);
  return normalizedOwnership === normalizedScope;
}

export class ListingOwnershipRequiredError extends Error {
  readonly code = 'LISTING_OWNERSHIP_REQUIRED' as const;
  readonly vendorId: string;

  constructor(vendorId: string, message?: string) {
    super(
      message ??
        "Listing ownership is required (use 'Own brand' or 'Third party') for vendors on the ownership commission model"
    );
    this.name = 'ListingOwnershipRequiredError';
    this.vendorId = vendorId;
  }
}

export function isListingOwnershipRequiredError(
  err: unknown
): err is ListingOwnershipRequiredError {
  return err instanceof ListingOwnershipRequiredError;
}

/** Parse vendor-facing ownership input (single upload, bulk column, API body). */
export function parseListingOwnershipInput(
  raw: string | null | undefined
): ListingOwnership | null {
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
    normalized === 'third' ||
    normalized === 'other'
  ) {
    return 'third_party';
  }

  if (normalized === 'own_brand') return 'own_brand';
  if (normalized === 'third_party') return 'third_party';

  return null;
}

/** Load vendor commission model; null if not configured. */
export async function getVendorCommissionModel(
  vendorId: string
): Promise<'category' | 'ownership' | null> {
  try {
    const result = await query(
      `SELECT commission_model FROM vendor_commission_config WHERE vendor_id = $1 LIMIT 1`,
      [vendorId]
    );
    const model = result.rows?.[0]?.commission_model;
    if (model === 'category' || model === 'ownership') return model;
    return null;
  } catch {
    return null;
  }
}

function extractDeclaredOwnership(
  declaredOwnership: unknown
): ListingOwnership | null {
  if (declaredOwnership === 'own_brand' || declaredOwnership === 'third_party') {
    return declaredOwnership;
  }
  if (declaredOwnership == null) return null;
  return parseListingOwnershipInput(String(declaredOwnership));
}

/**
 * Apply vendor-declared listing ownership from bulk upload / product create/update.
 *
 * - Ownership commission model: required (throws if missing/invalid).
 * - Category / unset model: optional, but when provided it is persisted so promo
 *   targeting (Owned / Third party) can filter seller inventory.
 */
export async function validateAndApplyVendorDeclaredOwnership(
  vendorId: string,
  payload: Record<string, unknown>,
  cols: Set<string>,
  declaredOwnership: unknown
): Promise<void> {
  if (!cols.has('listing_ownership')) return;

  const model = await getVendorCommissionModel(vendorId);
  const parsed = extractDeclaredOwnership(declaredOwnership);

  if (model === 'ownership') {
    if (!parsed) {
      throw new ListingOwnershipRequiredError(vendorId);
    }
    payload.listing_ownership = parsed;
    if (cols.has('listing_ownership_source')) {
      payload.listing_ownership_source = 'manual';
    }
    return;
  }

  if (!parsed) return;

  payload.listing_ownership = parsed;
  if (cols.has('listing_ownership_source')) {
    payload.listing_ownership_source = 'manual';
  }
}

/** Load stored listing ownership from product row. */
export async function getProductListingOwnership(
  productId: string
): Promise<ListingOwnership | null> {
  try {
    const result = await query(
      `SELECT listing_ownership FROM products WHERE id = $1::uuid LIMIT 1`,
      [productId]
    );
    const v = result.rows?.[0]?.listing_ownership;
    if (v === 'own_brand' || v === 'third_party') return v;
    return null;
  } catch {
    return null;
  }
}

/** Batch-load listing_ownership for cart product IDs (UUID base ids). */
export async function loadListingOwnershipByProductIds(
  productIds: string[]
): Promise<Map<string, ListingOwnership | null>> {
  const map = new Map<string, ListingOwnership | null>();
  const unique = Array.from(
    new Set(
      productIds
        .map((id) => {
          const raw = String(id || '');
          const sep = raw.indexOf('::');
          return sep > 0 ? raw.slice(0, sep) : raw;
        })
        .filter(Boolean)
    )
  );
  if (unique.length === 0) return map;
  try {
    const result = await query(
      `SELECT id::text AS id, listing_ownership
         FROM products
        WHERE id = ANY($1::uuid[])`,
      [unique]
    );
    for (const row of result.rows || []) {
      const v = row.listing_ownership;
      map.set(
        String(row.id),
        v === 'own_brand' || v === 'third_party' ? v : null
      );
    }
  } catch {
    /* products.listing_ownership may be absent in older envs */
  }
  return map;
}

export async function enrichLinesWithListingOwnership<
  T extends { productId: string; listingOwnership?: string | null },
>(lines: T[]): Promise<T[]> {
  if (lines.length === 0) return lines;
  if (lines.every((l) => l.listingOwnership === 'own_brand' || l.listingOwnership === 'third_party')) {
    return lines;
  }
  const ownershipMap = await loadListingOwnershipByProductIds(lines.map((l) => l.productId));
  return lines.map((line) => {
    if (line.listingOwnership === 'own_brand' || line.listingOwnership === 'third_party') {
      return line;
    }
    const raw = String(line.productId || '');
    const sep = raw.indexOf('::');
    const baseId = sep > 0 ? raw.slice(0, sep) : raw;
    const fromDb = ownershipMap.get(baseId);
    return fromDb != null ? { ...line, listingOwnership: fromDb } : line;
  });
}

