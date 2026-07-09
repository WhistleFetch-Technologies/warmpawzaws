/**
 * Bulk upload product identity — Warmpawz Product ID (products.id) for updates;
 * Product Group ID is upload-scoped grouping only (see bulk-product-variant-builder).
 */

import { randomUUID } from 'crypto';
import { query } from '../database/rds-connection';

export function normalizeProductGroupId(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

/** In-memory upload grouping key — Product Group ID scoped to current file only. */
export function resolveBulkUploadGroupKey(row: {
  warmpawz_product_id?: string | null;
  product_group_id?: string | null;
  rowNum?: number;
}): string {
  const wpid = String(row.warmpawz_product_id ?? '').trim();
  if (wpid) return `wpid::${wpid.toLowerCase()}`;

  const pgid = String(row.product_group_id ?? '').trim();
  if (pgid) return `pgid::${pgid.toLowerCase()}`;

  return `row::${row.rowNum ?? 0}`;
}

/** @deprecated Upload grouping only — not used for DB identity. */
export function productGroupIdentityKey(vendorId: string, productGroupId: string): string {
  return `${vendorId}::pgid::${normalizeProductGroupId(productGroupId)}`;
}

export function compositeIdentityKey(
  vendorId: string,
  brand: string,
  title: string,
  categoryKey: string,
): string {
  const b = normalizeProductGroupId(brand);
  const t = String(title ?? '').trim().toLowerCase();
  const c = String(categoryKey ?? '').trim().toLowerCase();
  return `${vendorId}::composite::${b}::${t}::${c}`;
}

export type BulkIdentityInput = {
  product_group_id?: string | null;
  name?: string;
  brand?: string | null;
  category?: string | null;
  category_id?: string | null;
};

/** @deprecated Use resolveBulkUploadGroupKey for in-upload grouping only. */
export function resolveBulkGroupKey(
  vendorId: string,
  row: BulkIdentityInput,
  categoryId?: string,
): string | null {
  const pgid = String(row.product_group_id ?? '').trim();
  if (pgid) return productGroupIdentityKey(vendorId, pgid);

  const title = String(row.name ?? '').trim();
  const categorySegment =
    categoryId?.trim() || String(row.category_id ?? '').trim() || String(row.category ?? '').trim();
  if (!title || !categorySegment) return null;

  const brand = String(row.brand ?? '').trim();
  return compositeIdentityKey(vendorId, brand, title, categorySegment);
}

export function generateProductGroupId(): string {
  return randomUUID();
}

export type ExistingVendorProduct = {
  id: string;
  sku?: string;
  category_id?: string;
  metadata?: unknown;
  images?: unknown;
};

/** Lookup parent product for bulk update — vendor_id + products.id only. */
export async function findExistingProductByWarmpawzId(
  vendorId: string,
  productId: string,
): Promise<ExistingVendorProduct | null> {
  const id = String(productId ?? '').trim();
  if (!id) return null;
  const r = await query(
    `SELECT id, sku, category_id, metadata, images FROM products
     WHERE vendor_id = $1 AND id = $2
     LIMIT 1`,
    [vendorId, id],
  );
  if (r.rows.length > 0) return r.rows[0] as ExistingVendorProduct;
  return null;
}

/** Batch-verify Warmpawz Product IDs belong to vendor. Returns set of valid ids. */
export async function findValidWarmpawzProductIdsForVendor(
  vendorId: string,
  productIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(productIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) return new Set();
  const r = await query(
    `SELECT id FROM products WHERE vendor_id = $1 AND id = ANY($2::uuid[])`,
    [vendorId, ids],
  );
  return new Set((r.rows as { id: string }[]).map((row) => String(row.id)));
}

/** @deprecated Bulk upload must not use metadata.product_group_id for update matching. */
export async function findExistingProductByGroupKey(
  vendorId: string,
  groupKey: string,
): Promise<ExistingVendorProduct | null> {
  if (groupKey.includes('::pgid::')) {
    const pgid = groupKey.split('::pgid::')[1] ?? '';
    if (!pgid) return null;
    const r = await query(
      `SELECT id, sku, category_id, metadata, images FROM products
       WHERE vendor_id = $1 AND lower(trim(metadata->>'product_group_id')) = $2
       LIMIT 1`,
      [vendorId, pgid],
    );
    if (r.rows.length > 0) return r.rows[0] as ExistingVendorProduct;
    return null;
  }

  if (!groupKey.includes('::composite::')) return null;
  const parts = groupKey.split('::composite::');
  const rest = parts[1] ?? '';
  const segments = rest.split('::');
  if (segments.length < 3) return null;
  const brand = segments[0];
  const title = segments[1];
  const categoryKey = segments[2];

  const byId = await query(
    `SELECT id, sku, category_id, metadata, images FROM products
     WHERE vendor_id = $1 AND lower(trim(name)) = $2 AND category_id::text = $3
       AND lower(trim(COALESCE(brand, ''))) = $4
     LIMIT 1`,
    [vendorId, title, categoryKey, brand],
  );
  if (byId.rows.length > 0) return byId.rows[0] as ExistingVendorProduct;

  const byName = await query(
    `SELECT id, sku, category_id, metadata, images FROM products
     WHERE vendor_id = $1 AND lower(trim(name)) = $2 AND lower(trim(category)) = $3
       AND lower(trim(COALESCE(brand, ''))) = $4
     LIMIT 1`,
    [vendorId, title, categoryKey, brand],
  );
  if (byName.rows.length > 0) return byName.rows[0] as ExistingVendorProduct;

  return null;
}

export function parseProductMetadata(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) };
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}
