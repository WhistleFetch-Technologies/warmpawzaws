/**
 * Shared SQL helpers for admin e-commerce marketplace analytics.
 */

import { SQL_ADMIN_SHOP_ORDER_TYPE } from './admin-ecommerce-orders-sql';

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export const SQL_ECOMMERCE_SELLER_ROLE = `
  r.name = 'pet_product' OR
  r.name = 'pet_products_store' OR
  r.name = 'product_seller' OR
  r.name = 'pet_product_seller' OR
  r.name = 'seller' OR
  (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
`;

export function calcPeriodGrowthPercent(current: number, previous: number): number {
  if (previous > 0) {
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }
  return current > 0 ? 100 : 0;
}

export function clampAnalyticsDays(raw: string | number | null | undefined): number {
  const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? '30'), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return Math.min(parsed, 365);
}

export function buildPeriodStartDates(days: number): {
  currentStart: Date;
  previousStart: Date;
} {
  const currentStart = new Date();
  currentStart.setDate(currentStart.getDate() - days);
  const previousStart = new Date();
  previousStart.setDate(previousStart.getDate() - days * 2);
  return { currentStart, previousStart };
}

export function buildDailyRevenueSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT
      DATE(o.created_at) AS date,
      COUNT(*)::int AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS gmv,
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) AS delivered_revenue
    FROM orders o
    WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}
      AND o.created_at >= $1
    GROUP BY DATE(o.created_at)
    ORDER BY DATE(o.created_at) ASC
  `;
  return { sql, params: [] };
}

export function buildPeriodTotalsSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= $1), 0) AS current_gmv,
      COALESCE(SUM(o.total_amount) FILTER (
        WHERE o.order_status = 'delivered' AND o.created_at >= $1
      ), 0) AS current_delivered_revenue,
      COUNT(*) FILTER (WHERE o.created_at >= $1)::int AS current_orders,
      COALESCE(SUM(o.total_amount) FILTER (
        WHERE o.created_at >= $2 AND o.created_at < $1
      ), 0) AS previous_gmv,
      COALESCE(SUM(o.total_amount) FILTER (
        WHERE o.order_status = 'delivered' AND o.created_at >= $2 AND o.created_at < $1
      ), 0) AS previous_delivered_revenue,
      COUNT(*) FILTER (WHERE o.created_at >= $2 AND o.created_at < $1)::int AS previous_orders
    FROM orders o
    WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}
      AND o.created_at >= $2
  `;
  return { sql, params: [] };
}

export function buildSellersWithOrdersSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT COUNT(DISTINCT o.vendor_id)::int AS seller_count
    FROM orders o
    WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}
      AND o.created_at >= $1
      AND o.created_at < $2
      AND o.vendor_id IS NOT NULL
  `;
  return { sql, params: [] };
}

export function buildProductStatsSql(lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD): {
  sql: string;
  params: unknown[];
} {
  const sql = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE p.is_active = true
          AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
      )::int AS active,
      COUNT(*) FILTER (
        WHERE p.is_active = true
          AND COALESCE(p.stock, 0) <= $1
      )::int AS low_stock
    FROM products p
  `;
  return { sql, params: [lowStockThreshold] };
}

export function buildEcommerceSellerStatsSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT
      COUNT(DISTINCT v.id) FILTER (WHERE
        v.is_active = true
        AND (v.is_deleted IS NULL OR v.is_deleted = false)
        AND (${SQL_ECOMMERCE_SELLER_ROLE})
      ) AS active_sellers,
      COUNT(DISTINCT v.id) FILTER (WHERE
        (v.is_deleted IS NULL OR v.is_deleted = false)
        AND (${SQL_ECOMMERCE_SELLER_ROLE})
      ) AS total_sellers
    FROM vendors v
    LEFT JOIN roles r ON v.role_id = r.id
  `;
  return { sql, params: [] };
}

export function buildTopProductsSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT
      p.name,
      COUNT(oi.id)::int AS sales,
      COALESCE(SUM(oi.total_price), 0) AS revenue
    FROM order_items oi
    INNER JOIN products p ON oi.product_id = p.id
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= $1
      AND o.order_status = 'delivered'
      AND ${SQL_ADMIN_SHOP_ORDER_TYPE}
    GROUP BY p.id, p.name
    ORDER BY sales DESC
    LIMIT 10
  `;
  return { sql, params: [] };
}

export function buildTopSellersSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT
      v.id,
      v.business_name AS name,
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= $1), 0) AS revenue,
      COUNT(o.id) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= $1)::int AS orders
    FROM vendors v
    INNER JOIN roles r ON v.role_id = r.id
    INNER JOIN orders o ON v.id = o.vendor_id
      AND o.order_status = 'delivered'
      AND o.created_at >= $1
      AND ${SQL_ADMIN_SHOP_ORDER_TYPE}
    WHERE (v.is_deleted IS NULL OR v.is_deleted = false)
      AND (${SQL_ECOMMERCE_SELLER_ROLE})
    GROUP BY v.id, v.business_name
    HAVING SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= $1) > 0
    ORDER BY revenue DESC
    LIMIT 10
  `;
  return { sql, params: [] };
}

export function buildPlatformPeriodGrowthSql(): { sql: string; params: unknown[] } {
  const sql = `
    SELECT
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days'), 0) AS current_gmv,
      COALESCE(SUM(o.total_amount) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days'
      ), 0) AS previous_gmv,
      COUNT(*) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days')::int AS current_orders,
      COUNT(*) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '60 days' AND o.created_at < NOW() - INTERVAL '30 days'
      )::int AS previous_orders,
      COALESCE(SUM(o.commission_amount) FILTER (
        WHERE o.payment_status = 'paid'
          AND o.commission_amount IS NOT NULL
          AND o.created_at >= NOW() - INTERVAL '30 days'
      ), 0) AS current_commission,
      COALESCE(SUM(o.commission_amount) FILTER (
        WHERE o.payment_status = 'paid'
          AND o.commission_amount IS NOT NULL
          AND o.created_at >= NOW() - INTERVAL '60 days'
          AND o.created_at < NOW() - INTERVAL '30 days'
      ), 0) AS previous_commission
    FROM orders o
    WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}
      AND o.created_at >= NOW() - INTERVAL '60 days'
  `;
  return { sql, params: [] };
}

export function stripAllStatusKey(counts: Record<string, number>): Record<string, number> {
  const { all, ...rest } = counts;
  return rest;
}
