import { query } from '../../../../database/rds-connection';
import { wpayCatalogueCustomerVisibleSql } from '../../../warmpawz-pay/shared/merchant/merchant-eligibility-sql';
import { merchantServiceCategoryFilterSql } from '../../../warmpawz-pay/shared/merchant/merchant-role-sql';
import { expandServiceCategoryFilterTokens } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import type { WpayVendorListDbRow } from './wpay-vendors-list.repo';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';
const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';

/** Same haversine expression as discovery/repos/radar-providers.repo.ts */
const HAVERSINE_KM_SQL = `(6371 * acos(
  cos(radians($1::double precision)) * cos(radians(CAST(v.latitude AS DOUBLE PRECISION))) *
  cos(radians(CAST(v.longitude AS DOUBLE PRECISION)) - radians($2::double precision)) +
  sin(radians($1::double precision)) * sin(radians(CAST(v.latitude AS DOUBLE PRECISION)))
))`;

export type WpayVendorsNearbyDbRow = WpayVendorListDbRow & {
  latitude: string | number | null;
  longitude: string | number | null;
  distance_km: string | number;
  avg_rating: string | number;
  review_count: string | number;
};

export type DbWpayVendorsNearbyListOpts = {
  customerLat?: number;
  customerLng?: number;
  limit?: number;
  maxDistanceKm?: number | null;
  category?: string | null;
};

export async function dbWpayVendorsNearbyList(
  opts: DbWpayVendorsNearbyListOpts
): Promise<WpayVendorsNearbyDbRow[]> {
  const customerLat = opts.customerLat;
  const customerLng = opts.customerLng;
  const limit = opts.limit;

  if (
    customerLat == null ||
    customerLng == null ||
    !Number.isFinite(customerLat) ||
    !Number.isFinite(customerLng) ||
    limit == null ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return [];
  }

  const conditions: string[] = [
    '(v.is_deleted IS NOT TRUE)',
    wpayCatalogueCustomerVisibleSql('c'),
    'v.latitude IS NOT NULL',
    'v.longitude IS NOT NULL',
  ];
  const params: unknown[] = [customerLat, customerLng];

  if (opts.maxDistanceKm != null && Number.isFinite(opts.maxDistanceKm) && opts.maxDistanceKm > 0) {
    params.push(opts.maxDistanceKm);
    conditions.push(`${HAVERSINE_KM_SQL} <= $${params.length}::double precision`);
  }

  if (opts.category && opts.category !== 'all') {
    const tokens = expandServiceCategoryFilterTokens(opts.category);
    if (tokens.length > 0) {
      params.push(tokens);
      conditions.push(merchantServiceCategoryFilterSql(`$${params.length}`));
    }
  }

  params.push(Math.floor(limit));
  const limitParam = params.length;

  const sql = `
    WITH scored AS (
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
        v.latitude,
        v.longitude,
        v.category AS legacy_category,
        r.customer_service,
        COALESCE(
          NULLIF(TRIM(r.config->>'category'), ''),
          NULLIF(TRIM(r.config->>'service_category'), ''),
          NULLIF(TRIM(r.config->>'serviceCategory'), ''),
          NULLIF(TRIM(r.role_type), '')
        ) AS role_category,
        r.config AS role_config,
        r.name AS role_name,
        r.display_name AS role_display_name,
        ${HAVERSINE_KM_SQL} AS distance_km
      FROM ${CATALOGUE_TABLE} c
      INNER JOIN vendors v ON v.id = c.vendor_id
      LEFT JOIN roles r ON r.id = v.role_id
      WHERE ${conditions.join(' AND ')}
    ),
    nearby AS (
      SELECT *
      FROM scored
      ORDER BY distance_km ASC, business_name ASC, catalogue_id ASC
      LIMIT $${limitParam}
    )
    SELECT
      n.catalogue_id,
      n.vendor_id,
      n.business_name,
      n.owner_name,
      n.address,
      n.city,
      n.phone,
      n.vendor_type,
      n.metadata,
      n.profile_photo_url,
      n.latitude,
      n.longitude,
      n.customer_service,
      n.role_category,
      n.role_config,
      n.legacy_category,
      n.role_name,
      n.role_display_name,
      n.distance_km,
      p.discount_value AS pricing_discount_value,
      p.status AS pricing_status,
      p.effective_from AS pricing_effective_from,
      p.effective_until AS pricing_effective_until,
      COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = n.vendor_id), 0)::float AS avg_rating,
      COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = n.vendor_id), 0)::int AS review_count
    FROM nearby n
    LEFT JOIN ${PRICING_TABLE} p ON p.vendor_id = n.vendor_id AND p.status = 'active'
    ORDER BY n.distance_km ASC, n.business_name ASC, n.catalogue_id ASC
  `;

  const result = await query(sql, params);
  return result.rows as WpayVendorsNearbyDbRow[];
}
