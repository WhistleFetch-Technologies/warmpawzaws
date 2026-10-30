import { query } from '../../../database/rds-connection';
import type { WpayPaymentsDateFilter } from '../admin/payments/dto/payments.requests';
import { buildWpayPaymentsDateFilterSql } from './wpay-payments-date-filter';

export const WPAY_ADMIN_PAYMENTS_MAX_EXPORT_ROWS = 5000;

export type WpayAdminPayoutStatusFilter = 'all' | 'pending' | 'settled';

export type WpayAdminPaymentsQueryFilters = {
  readonly dateFilter: WpayPaymentsDateFilter;
  readonly payoutStatus?: WpayAdminPayoutStatusFilter;
  readonly vendorSearch?: string;
};

export type WpayAdminPaymentDbRow = {
  payment_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  vendor_id: string;
  business_name: string | null;
  owner_name: string | null;
  vendor_type: string | null;
  legacy_category: string | null;
  customer_service: string | null;
  role_category: string | null;
  role_config: unknown;
  role_name: string | null;
  role_display_name: string | null;
  original_amount: string | number;
  discount_amount: string | number;
  payable_amount: string | number;
  discount_percent: string | number | null;
  paid_at: string;
  vendor_settlement_amount: string | number | null;
  platform_withhold_amount: string | number | null;
  platform_withhold_percent: string | number | null;
  payment_metadata: Record<string, unknown> | null;
  settlement_breakup: Record<string, unknown> | null;
  settlement_id: string | null;
  settlement_status: string | null;
  settlement_completed_at: string | null;
};

/** Successful Pay Bill rows — shared by the payments list and dashboard money totals. */
export const WPAY_PAYMENTS_BASE_WHERE = `
  p.payment_source = 'warmpawz_pay'
  AND p.payment_status = 'completed'
  AND p.completed_at IS NOT NULL
`;

const WPAY_PAYMENTS_SELECT = `
  p.id AS payment_id,
  p.customer_id,
  c.full_name AS customer_name,
  c.phone AS customer_phone,
  p.vendor_id,
  v.business_name,
  v.owner_name,
  v.vendor_type,
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
  p.original_amount,
  p.discount_amount,
  p.amount AS payable_amount,
  (p.metadata->>'quotedDiscountPercent')::numeric AS discount_percent,
  p.completed_at AS paid_at,
  s.net_amount AS vendor_settlement_amount,
  s.commission_amount AS platform_withhold_amount,
  (s.settlement_breakup->>'platformWithholdPercent')::numeric AS platform_withhold_percent,
  p.metadata AS payment_metadata,
  s.settlement_breakup AS settlement_breakup,
  s.id::text AS settlement_id,
  s.settlement_status AS settlement_status,
  s.completed_at AS settlement_completed_at
`;

const WPAY_PAYMENTS_FROM = `
  FROM payments p
  INNER JOIN customers c ON c.id = p.customer_id
  INNER JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN roles r ON r.id = v.role_id
  LEFT JOIN settlements s
    ON s.payment_id = p.id
   AND s.order_type = 'warmpawz_pay'
`;

export class WpayPaymentsExportTooLargeError extends Error {
  constructor(readonly total: number) {
    super(`Export exceeds maximum of ${WPAY_ADMIN_PAYMENTS_MAX_EXPORT_ROWS} rows (${total} matched)`);
    this.name = 'WpayPaymentsExportTooLargeError';
  }
}

function buildExtraFilterSql(
  filters: WpayAdminPaymentsQueryFilters,
  startParamIndex: number,
): { sql: string; params: unknown[]; nextParamIndex: number } {
  let sql = '';
  const params: unknown[] = [];
  let paramIndex = startParamIndex;

  const vendorSearch = String(filters.vendorSearch ?? '').trim();
  if (vendorSearch) {
    sql += ` AND (
      COALESCE(v.business_name, '') ILIKE $${paramIndex}
      OR COALESCE(v.owner_name, '') ILIKE $${paramIndex}
      OR p.vendor_id::text ILIKE $${paramIndex}
    )`;
    params.push(`%${vendorSearch}%`);
    paramIndex += 1;
  }

  const payoutStatus = filters.payoutStatus ?? 'all';
  if (payoutStatus === 'pending') {
    sql += ` AND s.id IS NOT NULL AND LOWER(COALESCE(s.settlement_status, '')) NOT IN ('completed', 'processed')`;
  } else if (payoutStatus === 'settled') {
    sql += ` AND LOWER(COALESCE(s.settlement_status, '')) IN ('completed', 'processed')`;
  }

  return { sql, params, nextParamIndex: paramIndex };
}

export async function dbWpayPlatformWithholdPercentByVendorIds(
  vendorIds: readonly string[],
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(vendorIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const result = await query(
    `SELECT vendor_id::text AS vendor_id, platform_withhold_percent
     FROM warmpawz_pay_merchant_pricing
     WHERE vendor_id = ANY($1::uuid[])`,
    [uniqueIds],
  );

  const map = new Map<string, number>();
  for (const row of result.rows as Array<{
    vendor_id: string;
    platform_withhold_percent: string | number | null;
  }>) {
    map.set(String(row.vendor_id), Number(row.platform_withhold_percent ?? 0));
  }
  return map;
}

async function countWpayAdminPayments(filters: WpayAdminPaymentsQueryFilters): Promise<number> {
  const datePart = buildWpayPaymentsDateFilterSql(filters.dateFilter, 1);
  const extra = buildExtraFilterSql(filters, datePart.nextParamIndex);
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     ${WPAY_PAYMENTS_FROM}
     WHERE ${WPAY_PAYMENTS_BASE_WHERE}${datePart.sql}${extra.sql}`,
    [...datePart.params, ...extra.params],
  );
  return Number((countResult.rows[0] as { total?: number })?.total ?? 0);
}

async function selectWpayAdminPayments(params: {
  filters: WpayAdminPaymentsQueryFilters;
  limit?: number;
  offset?: number;
}): Promise<WpayAdminPaymentDbRow[]> {
  const datePart = buildWpayPaymentsDateFilterSql(params.filters.dateFilter, 1);
  const extra = buildExtraFilterSql(params.filters, datePart.nextParamIndex);
  const queryParams = [...datePart.params, ...extra.params];
  let limitSql = '';
  let paramIndex = extra.nextParamIndex;

  if (params.limit != null) {
    queryParams.push(params.limit);
    limitSql += ` LIMIT $${paramIndex}`;
    paramIndex += 1;
  }
  if (params.offset != null) {
    queryParams.push(params.offset);
    limitSql += ` OFFSET $${paramIndex}`;
  }

  const result = await query(
    `SELECT ${WPAY_PAYMENTS_SELECT}
     ${WPAY_PAYMENTS_FROM}
     WHERE ${WPAY_PAYMENTS_BASE_WHERE}${datePart.sql}${extra.sql}
     ORDER BY p.completed_at DESC, p.id DESC${limitSql}`,
    queryParams,
  );

  return result.rows as WpayAdminPaymentDbRow[];
}

export async function dbWpayAdminPaymentsPage(params: {
  page: number;
  pageSize: number;
  filters: WpayAdminPaymentsQueryFilters;
}): Promise<{ rows: WpayAdminPaymentDbRow[]; total: number }> {
  const total = await countWpayAdminPayments(params.filters);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await selectWpayAdminPayments({
    filters: params.filters,
    limit: params.pageSize,
    offset,
  });
  return { rows, total };
}

export async function dbWpayAdminPaymentsExport(
  filters: WpayAdminPaymentsQueryFilters,
): Promise<WpayAdminPaymentDbRow[]> {
  const total = await countWpayAdminPayments(filters);
  if (total > WPAY_ADMIN_PAYMENTS_MAX_EXPORT_ROWS) {
    throw new WpayPaymentsExportTooLargeError(total);
  }
  return selectWpayAdminPayments({ filters });
}

/**
 * Mark WPay settlements as completed (vendor payout settled). Status-only; amounts unchanged.
 * One-way: only rows currently `pending` (or non-completed) are updated.
 */
export async function dbWpayAdminSettlePaymentsByPaymentIds(
  paymentIds: readonly string[],
): Promise<{ settledPaymentIds: string[] }> {
  const uniqueIds = [...new Set(paymentIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { settledPaymentIds: [] };
  }

  const result = await query(
    `UPDATE settlements s
     SET settlement_status = 'completed',
         completed_at = COALESCE(s.completed_at, NOW()),
         processed_at = COALESCE(s.processed_at, NOW())
     FROM payments p
     INNER JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE s.payment_id = p.id
       AND s.order_type = 'warmpawz_pay'
       AND p.payment_source = 'warmpawz_pay'
       AND p.payment_status = 'completed'
       AND p.id = ANY($1::uuid[])
       AND LOWER(COALESCE(s.settlement_status, '')) NOT IN ('completed', 'processed')
       AND (
         LOWER(COALESCE(r.name, '')) <> 'pet_store_walkin'
         OR (
           NULLIF(TRIM(s.settlement_breakup->>'billImageKey'), '') IS NOT NULL
           AND NULLIF(TRIM(s.settlement_breakup->>'billVerifiedAt'), '') IS NOT NULL
         )
       )
     RETURNING p.id::text AS payment_id`,
    [uniqueIds],
  );

  const settledPaymentIds = (result.rows as Array<{ payment_id?: string }>)
    .map((row) => String(row.payment_id ?? '').trim())
    .filter(Boolean);

  return { settledPaymentIds };
}

export type WpayAdminPaymentsDashboardTotals = {
  readonly payBillOrders: number;
  readonly customerPaid: number;
  readonly customerSaved: number;
  readonly platformRevenue: number;
  readonly platformFee: number;
  readonly platformFeeGst: number;
};

function asDashboardMoney(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Aggregates for completed Warmpawz Pay Bill payments.
 * Reuses the same success filter as the admin payments list (`total` / row source).
 * Optional IST month/range uses the same `completed_at` window as the payments list.
 * Sums persisted payment and settlement-breakup amounts — does not recalculate fees.
 */
export async function dbWpayAdminPaymentsDashboardTotals(
  db: { query: typeof query } = { query },
  dateFilter: WpayPaymentsDateFilter = { mode: 'none' },
): Promise<WpayAdminPaymentsDashboardTotals> {
  const datePart = buildWpayPaymentsDateFilterSql(dateFilter, 1);
  const result = await db.query(
    `SELECT
        COUNT(p.id)::int AS pay_bill_orders,
        COALESCE(SUM(p.amount), 0) AS customer_paid,
        COALESCE(SUM(p.discount_amount), 0) AS customer_saved,
        COALESCE(
          SUM(
            COALESCE(
              (s.settlement_breakup->>'wpayRevenueAmount')::numeric,
              s.commission_amount,
              0
            )
          ),
          0
        ) AS platform_revenue,
        COALESCE(
          SUM(
            COALESCE(
              NULLIF(s.settlement_breakup->>'platformFee', '')::numeric,
              NULLIF(p.metadata->>'platformFee', '')::numeric,
              0
            )
          ),
          0
        ) AS platform_fee,
        COALESCE(
          SUM(
            COALESCE(
              NULLIF(s.settlement_breakup->>'platformFeeGstAmount', '')::numeric,
              NULLIF(p.metadata->>'platformFeeGstAmount', '')::numeric,
              0
            )
          ),
          0
        ) AS platform_fee_gst
     FROM payments p
     LEFT JOIN settlements s
       ON s.payment_id = p.id
      AND s.order_type = 'warmpawz_pay'
     WHERE ${WPAY_PAYMENTS_BASE_WHERE}${datePart.sql}`,
    datePart.params,
  );

  const row = result.rows[0] as
    | {
        pay_bill_orders?: number | string;
        customer_paid?: number | string;
        customer_saved?: number | string;
        platform_revenue?: number | string;
        platform_fee?: number | string;
        platform_fee_gst?: number | string;
      }
    | undefined;

  return {
    payBillOrders: Number(row?.pay_bill_orders ?? 0) || 0,
    customerPaid: asDashboardMoney(row?.customer_paid),
    customerSaved: asDashboardMoney(row?.customer_saved),
    platformRevenue: asDashboardMoney(row?.platform_revenue),
    platformFee: asDashboardMoney(row?.platform_fee),
    platformFeeGst: asDashboardMoney(row?.platform_fee_gst),
  };
}

export type WpayAdminBillGateRow = {
  readonly paymentId: string;
  readonly settlementId: string | null;
  readonly roleName: string | null;
  readonly billImageKey: string | null;
  readonly billVerifiedAt: string | null;
  readonly billVerifiedBy: string | null;
  readonly settlementStatus: string | null;
};

export async function dbWpayAdminPaymentBillGates(
  paymentIds: readonly string[],
): Promise<WpayAdminBillGateRow[]> {
  const uniqueIds = [...new Set(paymentIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const result = await query(
    `SELECT p.id::text AS payment_id,
            s.id::text AS settlement_id,
            r.name AS role_name,
            NULLIF(TRIM(s.settlement_breakup->>'billImageKey'), '') AS bill_image_key,
            NULLIF(TRIM(s.settlement_breakup->>'billVerifiedAt'), '') AS bill_verified_at,
            NULLIF(TRIM(s.settlement_breakup->>'billVerifiedBy'), '') AS bill_verified_by,
            s.settlement_status
     FROM payments p
     LEFT JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     LEFT JOIN settlements s
       ON s.payment_id = p.id
      AND s.order_type = 'warmpawz_pay'
     WHERE p.id = ANY($1::uuid[])
       AND p.payment_source = 'warmpawz_pay'`,
    [uniqueIds],
  );

  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    paymentId: String(row.payment_id ?? ''),
    settlementId: row.settlement_id ? String(row.settlement_id) : null,
    roleName: row.role_name ? String(row.role_name) : null,
    billImageKey: row.bill_image_key ? String(row.bill_image_key) : null,
    billVerifiedAt: row.bill_verified_at ? String(row.bill_verified_at) : null,
    billVerifiedBy: row.bill_verified_by ? String(row.bill_verified_by) : null,
    settlementStatus: row.settlement_status ? String(row.settlement_status) : null,
  }));
}

export async function dbWpayAdminVerifyPaymentBill(opts: {
  readonly paymentId: string;
  readonly verifiedBy: string;
}): Promise<WpayAdminBillGateRow | null> {
  const result = await query(
    `UPDATE settlements s
     SET settlement_breakup = COALESCE(s.settlement_breakup, '{}'::jsonb)
       || jsonb_build_object(
            'billVerifiedAt', NOW()::text,
            'billVerifiedBy', $2::text
          )
     FROM payments p
     INNER JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE s.payment_id = p.id
       AND s.order_type = 'warmpawz_pay'
       AND p.payment_source = 'warmpawz_pay'
       AND p.id = $1::uuid
       AND NULLIF(TRIM(s.settlement_breakup->>'billImageKey'), '') IS NOT NULL
     RETURNING p.id::text AS payment_id,
               s.id::text AS settlement_id,
               r.name AS role_name,
               NULLIF(TRIM(s.settlement_breakup->>'billImageKey'), '') AS bill_image_key,
               NULLIF(TRIM(s.settlement_breakup->>'billVerifiedAt'), '') AS bill_verified_at,
               NULLIF(TRIM(s.settlement_breakup->>'billVerifiedBy'), '') AS bill_verified_by,
               s.settlement_status`,
    [opts.paymentId, opts.verifiedBy],
  );

  const row = (result.rows[0] || null) as Record<string, unknown> | null;
  if (!row) return null;
  return {
    paymentId: String(row.payment_id ?? ''),
    settlementId: row.settlement_id ? String(row.settlement_id) : null,
    roleName: row.role_name ? String(row.role_name) : null,
    billImageKey: row.bill_image_key ? String(row.bill_image_key) : null,
    billVerifiedAt: row.bill_verified_at ? String(row.bill_verified_at) : null,
    billVerifiedBy: row.bill_verified_by ? String(row.bill_verified_by) : null,
    settlementStatus: row.settlement_status ? String(row.settlement_status) : null,
  };
}

export type WpayAdminBillGateRow = {
  readonly paymentId: string;
  readonly roleName: string | null;
  readonly billImageKey: string | null;
  readonly billVerifiedAt: string | null;
  readonly billVerifiedBy: string | null;
  readonly settlementStatus: string | null;
};

export async function dbWpayAdminPaymentBillGates(
  paymentIds: readonly string[],
): Promise<WpayAdminBillGateRow[]> {
  const uniqueIds = [...new Set(paymentIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const result = await query(
    `SELECT p.id::text AS payment_id,
            r.name AS role_name,
            NULLIF(TRIM(s.settlement_breakup->>'billImageKey'), '') AS bill_image_key,
            NULLIF(TRIM(s.settlement_breakup->>'billVerifiedAt'), '') AS bill_verified_at,
            NULLIF(TRIM(s.settlement_breakup->>'billVerifiedBy'), '') AS bill_verified_by,
            s.settlement_status
     FROM payments p
     INNER JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     LEFT JOIN settlements s
       ON s.payment_id = p.id
      AND s.order_type = 'warmpawz_pay'
     WHERE p.id = ANY($1::uuid[])
       AND p.payment_source = 'warmpawz_pay'`,
    [uniqueIds],
  );

  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    paymentId: String(row.payment_id ?? ''),
    roleName: row.role_name != null ? String(row.role_name) : null,
    billImageKey: row.bill_image_key != null ? String(row.bill_image_key) : null,
    billVerifiedAt: row.bill_verified_at != null ? String(row.bill_verified_at) : null,
    billVerifiedBy: row.bill_verified_by != null ? String(row.bill_verified_by) : null,
    settlementStatus: row.settlement_status != null ? String(row.settlement_status) : null,
  }));
}

export async function dbWpayAdminVerifyPaymentBill(opts: {
  readonly paymentId: string;
  readonly verifiedBy: string;
}): Promise<boolean> {
  const result = await query(
    `UPDATE settlements s
     SET settlement_breakup = COALESCE(s.settlement_breakup, '{}'::jsonb)
       || jsonb_build_object(
            'billVerifiedAt', NOW()::text,
            'billVerifiedBy', $2::text
          )
     FROM payments p
     INNER JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE s.payment_id = p.id
       AND s.order_type = 'warmpawz_pay'
       AND p.id = $1::uuid
       AND p.payment_source = 'warmpawz_pay'
       AND LOWER(COALESCE(r.name, '')) = 'pet_store_walkin'
       AND NULLIF(TRIM(s.settlement_breakup->>'billImageKey'), '') IS NOT NULL
     RETURNING s.id`,
    [opts.paymentId, opts.verifiedBy],
  );
  return (result.rows?.length ?? 0) > 0;
}
