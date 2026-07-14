import { query } from '../../../database/rds-connection';
import { countActiveEcommerceAdminPromotions } from '../../../utils/count-active-ecommerce-promotions';
import type { AnalyticsDataSnapshot, PromotionUsageRow, CouponUsageRow, AnalyticsFilters } from '../types';

export interface UsageReadRepository {
  loadSnapshot(filters: AnalyticsFilters): Promise<AnalyticsDataSnapshot>;
}

function mapPromotionRow(row: Record<string, unknown>): PromotionUsageRow {
  return {
    id: String(row.id),
    promotionId: String(row.promotion_id ?? row.promotionId ?? ''),
    promotionType: String(row.promotion_type ?? row.promotionType ?? 'platform'),
    bookingId: row.booking_id ? String(row.booking_id) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    customerId: row.customer_id ? String(row.customer_id) : null,
    discountAmount: parseFloat(String(row.discount_amount ?? 0)) || 0,
    originalAmount: row.original_amount != null ? parseFloat(String(row.original_amount)) : null,
    finalAmount: row.final_amount != null ? parseFloat(String(row.final_amount)) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    promotionName: row.promotion_name ? String(row.promotion_name) : undefined,
    vendorId: row.vendor_id ? String(row.vendor_id) : null,
  };
}

function mapCouponRow(row: Record<string, unknown>): CouponUsageRow {
  let discountAmount = row.discount_amount != null ? parseFloat(String(row.discount_amount)) : undefined;
  if ((discountAmount == null || discountAmount <= 0) && row.discount_type && row.booking_total != null) {
    const amount = parseFloat(String(row.booking_total)) || 0;
    const value = parseFloat(String(row.discount_value ?? 0)) || 0;
    const dtype = String(row.discount_type);
    if (dtype === 'percentage' && amount > 0) {
      discountAmount = (amount * value) / 100;
      const cap = row.max_discount_amount ?? row.max_discount;
      if (cap != null) discountAmount = Math.min(discountAmount, parseFloat(String(cap)));
    } else if (dtype === 'fixed') {
      discountAmount = value;
    }
  }
  return {
    id: String(row.id),
    couponId: String(row.coupon_id ?? row.couponId ?? ''),
    code: String(row.code ?? ''),
    customerId: row.customer_id ? String(row.customer_id) : null,
    bookingId: row.booking_id ? String(row.booking_id) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    usedAt: String(row.used_at ?? row.created_at ?? new Date().toISOString()),
    maxUses: row.max_uses != null ? parseInt(String(row.max_uses), 10) : null,
    isActive: row.is_active !== false,
    endDate: row.end_date ? String(row.end_date) : null,
    discountAmount: discountAmount != null ? parseFloat(String(discountAmount)) : undefined,
  };
}

function mapEcommerceCouponRow(row: Record<string, unknown>): CouponUsageRow {
  return {
    id: String(row.id),
    couponId: String(row.promotion_id ?? row.couponId ?? ''),
    code: String(row.code ?? ''),
    customerId: row.customer_id ? String(row.customer_id) : null,
    bookingId: null,
    orderId: row.order_id ? String(row.order_id) : null,
    usedAt: String(row.created_at ?? new Date().toISOString()),
    maxUses: row.max_uses != null ? parseInt(String(row.max_uses), 10) : null,
    isActive: row.is_active !== false,
    endDate: row.end_date ? String(row.end_date) : null,
    discountAmount:
      row.discount_amount != null ? parseFloat(String(row.discount_amount)) : undefined,
  };
}

async function loadEcommerceCouponUsages(filters: AnalyticsFilters): Promise<CouponUsageRow[]> {
  const params: unknown[] = [];
  let sql = `
    SELECT pu.id, pu.promotion_id, pu.order_id, pu.customer_id, pu.discount_amount, pu.created_at,
           COALESCE(NULLIF(TRIM(eap.code), ''), NULLIF(TRIM(vp.code), '')) AS code,
           COALESCE(eap.usage_limit, vp.usage_limit) AS max_uses,
           COALESCE(eap.is_active, vp.is_active, true) AS is_active,
           COALESCE(eap.end_date, vp.end_date) AS end_date
    FROM promotion_usages pu
    LEFT JOIN ecommerce_admin_promotions eap ON eap.id::text = pu.promotion_id::text
    LEFT JOIN vendor_promotions vp ON vp.id::text = pu.promotion_id::text
    WHERE pu.order_id IS NOT NULL
      AND (
        (eap.code IS NOT NULL AND TRIM(eap.code) <> '')
        OR (vp.code IS NOT NULL AND TRIM(vp.code) <> '')
      )
  `;

  if (filters.from) {
    params.push(filters.from);
    sql += ` AND pu.created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` AND pu.created_at <= $${params.length}`;
  }
  if (filters.customerId) {
    params.push(filters.customerId);
    sql += ` AND pu.customer_id = $${params.length}::uuid`;
  }

  sql += ' ORDER BY pu.created_at DESC LIMIT 10000';

  const res = await query(sql, params).catch(() => ({ rows: [] }));
  return (res.rows ?? []).map((r: Record<string, unknown>) => mapEcommerceCouponRow(r));
}

async function countActivePromotions(domain: AnalyticsFilters['domain']): Promise<number> {
  if (domain === 'PRODUCT') {
    return countActiveEcommerceAdminPromotions();
  }

  const activeRes = await query(
    'SELECT COUNT(*) AS count FROM promotions WHERE is_active = true AND (end_date IS NULL OR end_date >= NOW())',
  ).catch(() => ({ rows: [{ count: '0' }] }));
  return parseInt(String(activeRes.rows?.[0]?.count ?? '0'), 10);
}

/**
 * Read-only repository — aggregates from existing usage tables.
 * Does not write or recalculate discounts.
 */
export class RdsUsageReadRepository implements UsageReadRepository {
  async loadSnapshot(filters: AnalyticsFilters): Promise<AnalyticsDataSnapshot> {
    const params: unknown[] = [];
    let promoSql = `
      SELECT pu.*,
             COALESCE(eap.name, vp.name, p.name) AS promotion_name,
             COALESCE(vp.vendor_id, NULL::uuid) AS vendor_id
      FROM promotion_usages pu
      LEFT JOIN promotions p ON p.id::text = pu.promotion_id::text
      LEFT JOIN ecommerce_admin_promotions eap ON eap.id::text = pu.promotion_id::text
      LEFT JOIN vendor_promotions vp ON vp.id::text = pu.promotion_id::text
      WHERE 1=1
    `;

    if (filters.from) {
      params.push(filters.from);
      promoSql += ` AND pu.created_at >= $${params.length}`;
    }
    if (filters.to) {
      params.push(filters.to);
      promoSql += ` AND pu.created_at <= $${params.length}`;
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      promoSql += ` AND pu.customer_id = $${params.length}::uuid`;
    }
    if (filters.promotionIds?.length) {
      params.push(filters.promotionIds);
      promoSql += ` AND pu.promotion_id = ANY($${params.length}::uuid[])`;
    }

    promoSql += ' ORDER BY pu.created_at DESC LIMIT 10000';

    const couponParams: unknown[] = [];
    let couponSql = `
      SELECT cu.*, c.code, c.max_uses, c.is_active, c.end_date, c.discount_type, c.discount_value,
             c.max_discount_amount, c.max_discount,
             b.total_amount AS booking_total
      FROM coupon_usages cu
      LEFT JOIN coupons c ON c.id = cu.coupon_id
      LEFT JOIN bookings b ON b.id = cu.booking_id
      WHERE 1=1
    `;

    if (filters.from) {
      couponParams.push(filters.from);
      couponSql += ` AND cu.used_at >= $${couponParams.length}`;
    }
    if (filters.to) {
      couponParams.push(filters.to);
      couponSql += ` AND cu.used_at <= $${couponParams.length}`;
    }
    if (filters.customerId) {
      couponParams.push(filters.customerId);
      couponSql += ` AND cu.customer_id = $${couponParams.length}::uuid`;
    }
    if (filters.couponIds?.length) {
      couponParams.push(filters.couponIds);
      couponSql += ` AND cu.coupon_id = ANY($${couponParams.length}::uuid[])`;
    }

    couponSql += ' ORDER BY cu.used_at DESC LIMIT 10000';

    const [promoRes, couponRes, activeCount, ecommerceCouponRows] = await Promise.all([
      query(promoSql, params).catch(() => ({ rows: [] })),
      query(couponSql, couponParams).catch(() => ({ rows: [] })),
      countActivePromotions(filters.domain),
      filters.domain === 'PRODUCT' ? loadEcommerceCouponUsages(filters) : Promise.resolve([]),
    ]);

    const bookingCoupons = (couponRes.rows ?? []).map((r: Record<string, unknown>) =>
      mapCouponRow(r),
    );
    const couponUsages =
      filters.domain === 'PRODUCT'
        ? [...ecommerceCouponRows, ...bookingCoupons.filter((c) => Boolean(c.orderId))]
        : bookingCoupons;

    return {
      promotionUsages: (promoRes.rows ?? []).map((r: Record<string, unknown>) => mapPromotionRow(r)),
      couponUsages,
      activePromotionCount: activeCount,
    };
  }
}

let defaultRepo: UsageReadRepository | null = null;

export function getUsageReadRepository(): UsageReadRepository {
  if (!defaultRepo) defaultRepo = new RdsUsageReadRepository();
  return defaultRepo;
}

export function setUsageReadRepositoryForTests(repo: UsageReadRepository | null): void {
  defaultRepo = repo;
}
