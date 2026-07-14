/**
 * Ecommerce category row shaping + S3 image URL handling for admin/storefront APIs.
 */

import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from './s3-media-presign';
import { parseCategoryCommissionRate } from './ecommerce-commission-settings';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEcommerceCategoryUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

export function normalizeCategoryImageUrlForStorage(url: unknown): string | null {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return null;
  return stripS3PresignQueryFromUrl(trimmed);
}

export type EcommerceCategoryPublicRow = {
  id: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
  default_commission_rate: number | null;
  returns_enabled: boolean;
  /** Storefront-active products in this category (public catalog only). */
  product_count: number;
  /** Parent category id for hierarchical (sub)categories, or null for top-level. */
  parent_category_id: string | null;
  created_at?: string;
};

export async function mapCategoryRowForPublic(
  row: Record<string, unknown>,
  opts?: { includeInactive?: boolean }
): Promise<EcommerceCategoryPublicRow> {
  const rawImage = row.image_url ?? row.imageUrl;
  let imageUrl: string | null = null;
  if (rawImage != null && String(rawImage).trim()) {
    const stored = String(rawImage).trim();
    imageUrl = (await presignS3GetUrlIfApplicable(stored)) ?? stored;
  }

  const isActive = row.is_active !== false && row.is_active !== 'false';

  const commissionRaw = row.default_commission_rate ?? row.defaultCommissionRate;
  const defaultCommissionRate =
    commissionRaw != null && commissionRaw !== '' && !Number.isNaN(Number(commissionRaw))
      ? Number(commissionRaw)
      : null;

  const returnsRaw = row.returns_enabled ?? row.returnsEnabled;
  const returns_enabled =
    returnsRaw === true || returnsRaw === 'true' || returnsRaw === 1 || returnsRaw === '1';

  const productCountRaw = row.product_count ?? row.productCount;
  const product_count =
    productCountRaw != null && productCountRaw !== ''
      ? Math.max(0, parseInt(String(productCountRaw), 10) || 0)
      : 0;

  const parentRaw = row.parent_category_id ?? row.parentCategoryId ?? row.parentId;
  const parent_category_id =
    parentRaw != null && String(parentRaw).trim() ? String(parentRaw).trim() : null;

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? '').trim(),
    description: String(row.description ?? '').trim(),
    display_order: parseInt(String(row.display_order ?? row.displayOrder ?? 0), 10) || 0,
    is_active: opts?.includeInactive ? isActive : true,
    image_url: imageUrl,
    default_commission_rate: defaultCommissionRate,
    returns_enabled,
    product_count,
    parent_category_id,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export async function mapCategoryRowsForPublic(
  rows: Record<string, unknown>[],
  opts?: { includeInactive?: boolean }
): Promise<EcommerceCategoryPublicRow[]> {
  return Promise.all(rows.map((r) => mapCategoryRowForPublic(r, opts)));
}

/** Normalize admin bulk-save payload field names onto DB columns. */
export function parseAdminCategoryPayloadItem(item: Record<string, unknown>): {
  id: string | null;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
  default_commission_rate: number | null;
  returns_enabled: boolean;
  parent_category_id: string | null;
} {
  const name = String(item.name ?? '').trim();
  const rawId = item.id != null ? String(item.id).trim() : '';
  const id = isEcommerceCategoryUuid(rawId) ? rawId : null;

  const enabled =
    item.enabled !== undefined
      ? item.enabled !== false && item.enabled !== 'false'
      : item.is_active !== false && item.is_active !== 'false';

  const orderRaw = item.order ?? item.display_order ?? item.displayOrder ?? 0;
  const display_order = parseInt(String(orderRaw), 10) || 0;

  const rawImage = item.image_url ?? item.imageUrl ?? item.icon;
  const image_url = normalizeCategoryImageUrlForStorage(rawImage);

  const rawParentId = item.parent_category_id ?? item.parentCategoryId ?? item.parentId;
  const parentIdStr = rawParentId != null ? String(rawParentId).trim() : '';
  const parent_category_id =
    parentIdStr && isEcommerceCategoryUuid(parentIdStr) && parentIdStr !== id ? parentIdStr : null;

  return {
    id,
    name,
    description:
      item.description != null && String(item.description).trim()
        ? String(item.description).trim()
        : null,
    display_order,
    is_active: enabled,
    image_url,
    default_commission_rate: parseCategoryCommissionRate(item),
    returns_enabled:
      item.returns_enabled === true ||
      item.returns_enabled === 'true' ||
      item.returnsEnabled === true ||
      item.returnsEnabled === 'true',
    parent_category_id,
  };
}
