import { query } from '../../../database/rds-connection';
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
    discountAmount: row.discount_amount != null ? parseFloat(String(row.discount_amount)) : undefined,
  };
}

/**
 * Read-only repository — aggregates from existing usage tables.
 * Does not write or recalculate discounts.
 */
export class RdsUsageReadRepository implements UsageReadRepository {
  async loadSnapshot(filters: AnalyticsFilters): Promise<AnalyticsDataSnapshot> {
    const params: unknown[] = [];
    let promoSql = `
      SELECT pu.*, p.name AS promotion_name, NULL::uuid AS vendor_id
      FROM promotion_usages pu
      LEFT JOIN promotions p ON p.id::text = pu.promotion_id::text
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
      SELECT cu.*, c.code, c.max_uses, c.is_active, c.end_date, NULL::numeric AS discount_amount
      FROM coupon_usages cu
      LEFT JOIN coupons c ON c.id = cu.coupon_id
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

    const [promoRes, couponRes, activeRes] = await Promise.all([
      query(promoSql, params).catch(() => ({ rows: [] })),
      query(couponSql, couponParams).catch(() => ({ rows: [] })),
      query(
        'SELECT COUNT(*) AS count FROM promotions WHERE is_active = true AND (end_date IS NULL OR end_date >= NOW())'
      ).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    return {
      promotionUsages: (promoRes.rows ?? []).map((r: Record<string, unknown>) => mapPromotionRow(r)),
      couponUsages: (couponRes.rows ?? []).map((r: Record<string, unknown>) => mapCouponRow(r)),
      activePromotionCount: parseInt(String(activeRes.rows?.[0]?.count ?? '0'), 10),
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
