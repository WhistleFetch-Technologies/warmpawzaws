/**
 * Shared SQL helpers for admin marketplace (shop) order list, counts, and detail.
 */

/** SQL fragment — alias `o` must be the orders table. */
export const SQL_ADMIN_SHOP_ORDER_TYPE = `
  LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
`;

export type AdminEcommerceOrderListFilters = {
  status?: string | null;
  period?: string | null;
  search?: string | null;
};

export type AdminEcommerceOrderSqlParts = {
  whereClauses: string[];
  params: unknown[];
  nextParamIndex: number;
};

const ORDER_STATUS_VALUES = [
  'pending',
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

export function resolveAdminOrderPeriodDays(period: string | null | undefined): number | null {
  if (!period || period === 'all') return null;
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return null;
}

export function buildAdminEcommerceOrderFilterSql(
  filters: AdminEcommerceOrderListFilters,
  startParamIndex = 1,
): AdminEcommerceOrderSqlParts {
  const whereClauses: string[] = [SQL_ADMIN_SHOP_ORDER_TYPE];
  const params: unknown[] = [];
  let paramIndex = startParamIndex;

  const periodDays = resolveAdminOrderPeriodDays(filters.period);
  if (periodDays != null) {
    whereClauses.push(`o.created_at >= NOW() - INTERVAL '${periodDays} days'`);
  }

  const status = filters.status?.trim();
  if (status && status !== 'all') {
    whereClauses.push(`o.order_status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const search = filters.search?.trim();
  if (search) {
    whereClauses.push(
      `(o.order_number ILIKE $${paramIndex} OR c.full_name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex} OR v.business_name ILIKE $${paramIndex})`,
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  return { whereClauses, params, nextParamIndex: paramIndex };
}

export function buildAdminEcommerceOrderListSql(
  filters: AdminEcommerceOrderListFilters,
  limit: number,
  offset: number,
): { sql: string; params: unknown[] } {
  const { whereClauses, params, nextParamIndex } = buildAdminEcommerceOrderFilterSql(filters);
  const limitIdx = nextParamIndex;
  const offsetIdx = nextParamIndex + 1;

  const sql = `
    SELECT
      o.id,
      o.order_number,
      o.order_status AS status,
      o.customer_id,
      o.vendor_id,
      c.full_name AS customer_name,
      c.phone AS customer_phone,
      v.business_name AS vendor_name,
      o.total_amount,
      o.discount_amount,
      o.payment_status,
      o.payment_method,
      o.created_at,
      (
        SELECT COUNT(*)::int
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS item_count
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN vendors v ON o.vendor_id = v.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY o.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  return { sql, params: [...params, limit, offset] };
}

export function buildAdminEcommerceOrderCountSql(
  filters: AdminEcommerceOrderListFilters,
): { sql: string; params: unknown[] } {
  const { whereClauses, params } = buildAdminEcommerceOrderFilterSql(filters);

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN vendors v ON o.vendor_id = v.id
    WHERE ${whereClauses.join(' AND ')}
  `;

  return { sql, params };
}

export function buildAdminEcommerceOrderStatusCountsSql(period?: string | null): {
  sql: string;
  params: unknown[];
} {
  const periodDays = resolveAdminOrderPeriodDays(period);
  if (periodDays != null) {
    return buildAdminEcommerceOrderStatusCountsSqlForDays(periodDays);
  }

  const sql = `
    SELECT
      o.order_status AS status,
      COUNT(*)::int AS count
    FROM orders o
    WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}
    GROUP BY o.order_status
  `;

  return { sql, params: [] };
}

export function buildAdminEcommerceOrderStatusCountsSqlForDays(days: number): {
  sql: string;
  params: unknown[];
} {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 365) : 30;
  const sql = `
    SELECT
      o.order_status AS status,
      COUNT(*)::int AS count
    FROM orders o
    WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}
      AND o.created_at >= NOW() - INTERVAL '${safeDays} days'
    GROUP BY o.order_status
  `;

  return { sql, params: [] };
}

export function normalizeAdminOrderStatusCounts(rows: Array<{ status?: string; count?: number }>): Record<string, number> {
  const counts: Record<string, number> = { all: 0 };
  for (const status of ORDER_STATUS_VALUES) {
    counts[status] = 0;
  }

  for (const row of rows) {
    const status = String(row.status || '').trim();
    const count = Number(row.count || 0);
    if (!status) continue;
    counts[status] = (counts[status] || 0) + count;
    counts.all += count;
  }

  return counts;
}

export function formatAdminOrderDeliveryAddress(order: {
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
}): string {
  const parts = [
    order.shipping_address,
    order.shipping_city,
    order.shipping_state,
    order.shipping_pincode,
  ]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean);
  return parts.join(', ');
}

export function enrichAdminEcommerceOrderDetail(order: Record<string, unknown>): Record<string, unknown> {
  const shippingAmount = Number(order.shipping_amount ?? order.shipping_fee ?? 0);
  const deliveryAddress = formatAdminOrderDeliveryAddress({
    shipping_address: order.shipping_address as string | null,
    shipping_city: order.shipping_city as string | null,
    shipping_state: order.shipping_state as string | null,
    shipping_pincode: order.shipping_pincode as string | null,
  });

  return {
    ...order,
    status: order.order_status ?? order.status,
    shipping_amount: shippingAmount,
    shipping_fee: shippingAmount,
    delivery_address: deliveryAddress || order.delivery_address || null,
    tracking_number: order.tracking_number ?? order.shipment_tracking_number ?? null,
    tracking_url: order.tracking_url ?? order.shipment_tracking_url ?? null,
    carrier: order.delivery_partner ?? order.shipment_carrier_name ?? null,
  };
}
