/**
 * Vendor-declared listing ownership for ecommerce commission V2.
 */

import { query } from '../database/rds-connection';

export type ListingOwnership = 'own_brand' | 'third_party';
export type ListingOwnershipSource = 'auto' | 'manual' | 'admin';

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
 * Apply vendor-declared listing ownership when vendor uses ownership commission model.
 * Category-model vendors: no-op (listing_ownership not set).
 */
export async function validateAndApplyVendorDeclaredOwnership(
  vendorId: string,
  payload: Record<string, unknown>,
  cols: Set<string>,
  declaredOwnership: unknown
): Promise<void> {
  if (!cols.has('listing_ownership')) return;

  const model = await getVendorCommissionModel(vendorId);
  if (model !== 'ownership') return;

  const parsed = extractDeclaredOwnership(declaredOwnership);
  if (!parsed) {
    throw new ListingOwnershipRequiredError(vendorId);
  }

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
