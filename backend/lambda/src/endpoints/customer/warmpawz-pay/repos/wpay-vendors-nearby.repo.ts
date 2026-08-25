import { query } from '../../../../database/rds-connection';
import { wpayCatalogueCustomerVisibleSql } from '../../../warmpawz-pay/shared/merchant/merchant-eligibility-sql';
import { wapptCatalogueCustomerVisibleSql } from '../../../warmpawz-appointments/shared/catalogue-eligibility-sql';
import { merchantServiceCategoryFilterSql } from '../../../warmpawz-pay/shared/merchant/merchant-role-sql';
import { expandServiceCategoryFilterTokens } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import type { WpayVendorListDbRow } from './wpay-vendors-list.repo';

const WPAY_CATALOGUE = 'warmpawz_pay_vendor_catalog';
const WAPPT_CATALOGUE = 'warmpawz_appointments_vendor_catalog';
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
  warmpawz_pay_eligible: boolean;
  appointment_eligible: boolean;
};

export type DbWpayVendorsNearbyListOpts = {
  customerLat?: number;
  customerLng?: number;
  limit?: number;
  offset?: number;
  maxDistanceKm?: number | null;
  category?: string | null;
};

export type DbWpayVendorsNearbyPage = {
  rows: WpayVendorsNearbyDbRow[];
  hasMore: boolean;
};

export async function dbWpayVendorsNearbyList(
  opts: DbWpayVendorsNearbyListOpts
): Promise<WpayVendorsNearbyDbRow[]> {
  const page = await dbWpayVendorsNearbyPage(opts);
  return page.rows;
}

export async function dbWpayVendorsNearbyPage(
  opts: DbWpayVendorsNearbyListOpts
): Promise<DbWpayVendorsNearbyPage> {
  const customerLat = opts.customerLat;
  const customerLng = opts.customerLng;
  const limit = opts.limit;
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));

  if (
    customerLat == null ||
    customerLng == null ||
    !Number.isFinite(customerLat) ||
    !Number.isFinite(customerLng) ||
    limit == null ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return { rows: [], hasMore: false };
  }

  const conditions: string[] = [
    '(v.is_deleted IS NOT TRUE)',
    'v.latitude IS NOT NULL',
    'v.longitude IS NOT NULL',
    '(c.id IS NOT NULL OR a.id IS NOT NULL)',
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

  params.push(Math.floor(limit) + 1);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const sql = `
    WITH scored AS (
      SELECT
        COALESCE(c.id, a.id) AS catalogue_id,
        v.id AS vendor_id,
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
        (c.id IS NOT NULL) AS warmpawz_pay_eligible,
        (a.id IS NOT NULL) AS appointment_eligible,
        ${HAVERSINE_KM_SQL} AS distance_km
      FROM vendors v
      LEFT JOIN ${WPAY_CATALOGUE} c
        ON c.vendor_id = v.id AND ${wpayCatalogueCustomerVisibleSql('c')}
      LEFT JOIN ${WAPPT_CATALOGUE} a
        ON a.vendor_id = v.id AND ${wapptCatalogueCustomerVisibleSql('a')}
      LEFT JOIN roles r ON r.id = v.role_id
      WHERE ${conditions.join(' AND ')}
    ),
    nearby AS (
      SELECT *
      FROM scored
      ORDER BY distance_km ASC, business_name ASC, vendor_id ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
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
      n.warmpawz_pay_eligible,
      n.appointment_eligible,
      (
        SELECT vs.service_style
        FROM vendor_services vs
        WHERE vs.vendor_id = n.vendor_id
          AND vs.is_enabled = true
          AND vs.service_style = ANY(ARRAY['at_center','at_vendor','at_clinic','at_home','home_visit']::text[])
        GROUP BY vs.service_style
        ORDER BY COUNT(*) DESC, vs.service_style ASC
        LIMIT 1
      ) AS preferred_service_style,
      p.discount_value AS pricing_discount_value,
      p.status AS pricing_status,
      p.effective_from AS pricing_effective_from,
      p.effective_until AS pricing_effective_until,
      COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = n.vendor_id), 0)::float AS avg_rating,
      COALESCE((SELECT COUNT(*) FROM reviews WHERE vendor_id = n.vendor_id), 0)::int AS review_count
    FROM nearby n
    LEFT JOIN ${PRICING_TABLE} p ON p.vendor_id = n.vendor_id AND p.status = 'active'
    ORDER BY n.distance_km ASC, n.business_name ASC, n.vendor_id ASC
  `;

  const result = await query(sql, params);
  const allRows = result.rows as WpayVendorsNearbyDbRow[];
  const hasMore = allRows.length > Math.floor(limit);
  const rows = hasMore ? allRows.slice(0, Math.floor(limit)) : allRows;
  return { rows, hasMore };
}
