import { query } from '../../../../database/rds-connection';
import { wpayCatalogueCustomerVisibleSql } from '../../../warmpawz-pay/shared/merchant/merchant-eligibility-sql';
import { merchantServiceCategoryFilterSql } from '../../../warmpawz-pay/shared/merchant/merchant-role-sql';
import { expandServiceCategoryFilterTokens } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import {
  decodeWpayVendorCursor,
  encodeWpayVendorCursor,
  type WpayVendorCursor,
} from '../shared/wpay-vendor-cursor';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';
const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';

export type WpayVendorListDbRow = {
  catalogue_id: string;
  vendor_id: string;
  business_name: string;
  owner_name: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  vendor_type: string | null;
  metadata: unknown;
  profile_photo_url: string | null;
  customer_service: string | null;
  role_category: string | null;
  role_config: unknown;
  legacy_category: string | null;
  role_name: string | null;
  role_display_name: string | null;
  preferred_service_style: string | null;
  pricing_discount_value: string | number | null;
  pricing_status: string | null;
  pricing_effective_from: Date | string | null;
  pricing_effective_until: Date | string | null;
  pricing_tier_id?: string | null;
  pricing_tier_name?: string | null;
  pricing_commission_rate?: string | number | null;
  pricing_platform_withhold_percent?: string | number | null;
};

export type DbWpayVendorListPage = {
  rows: WpayVendorListDbRow[];
  nextCursor: string | null;
};

export async function dbWpayVendorsListPage(opts: {
  limit: number;
  cursor?: string | null;
  category?: string | null;
  /** Residual tokens from search taxonomy — AND ILIKE on business_name. */
  nameTokens?: string[];
}): Promise<DbWpayVendorListPage> {
  const conditions: string[] = ['(v.is_deleted IS NOT TRUE)', wpayCatalogueCustomerVisibleSql('c')];
  const params: unknown[] = [];

  if (opts.category && opts.category !== 'all') {
    const tokens = expandServiceCategoryFilterTokens(opts.category);
    if (tokens.length > 0) {
      params.push(tokens);
      conditions.push(merchantServiceCategoryFilterSql(`$${params.length}`));
    }
  }

  for (const token of opts.nameTokens ?? []) {
    const t = String(token || '').trim();
    if (!t) continue;
    params.push(`%${t}%`);
    conditions.push(`v.business_name ILIKE $${params.length}`);
  }

  if (opts.cursor) {
    const decoded = decodeWpayVendorCursor(opts.cursor);
    if (decoded) {
      params.push(decoded.businessName, decoded.catalogueId);
      conditions.push(`(v.business_name, c.id) > ($${params.length - 1}, $${params.length})`);
    }
  }

  const fetchLimit = opts.limit + 1;
  params.push(fetchLimit);
  const limitParam = params.length;

  const sql = `
    SELECT
      c.id AS catalogue_id,
      c.vendor_id,
      v.business_name,
      v.owner_name,
      v.address,
      v.city,
      v.phone,
      v.vendor_type,
      v.metadata,
      v.profile_photo_url,
      r.customer_service,
      COALESCE(
        NULLIF(TRIM(r.config->>'category'), ''),
        NULLIF(TRIM(r.config->>'service_category'), ''),
        NULLIF(TRIM(r.config->>'serviceCategory'), ''),
        NULLIF(TRIM(r.role_type), '')
      ) AS role_category,
      r.config AS role_config,
      v.category AS legacy_category,
      r.name AS role_name,
      r.display_name AS role_display_name,
      p.discount_value AS pricing_discount_value,
      p.status AS pricing_status,
      p.effective_from AS pricing_effective_from,
      p.effective_until AS pricing_effective_until,
      p.tier_id AS pricing_tier_id,
      vt.tier_name AS pricing_tier_name,
      vt.commission_rate AS pricing_commission_rate,
      p.platform_withhold_percent AS pricing_platform_withhold_percent
    FROM ${CATALOGUE_TABLE} c
    INNER JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    LEFT JOIN ${PRICING_TABLE} p ON p.vendor_id = c.vendor_id
    LEFT JOIN vendor_tiers vt ON vt.id = p.tier_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY v.business_name ASC, c.id ASC
    LIMIT $${limitParam}
  `;

  const result = await query(sql, params);
  const allRows = result.rows as WpayVendorListDbRow[];
  const pageRows = allRows.slice(0, opts.limit);
  const hasMore = allRows.length > opts.limit;
  const last = pageRows[pageRows.length - 1];

  let nextCursor: string | null = null;
  if (hasMore && last) {
    nextCursor = encodeWpayVendorCursor(last.business_name, last.catalogue_id);
  }

  return { rows: pageRows, nextCursor };
}
