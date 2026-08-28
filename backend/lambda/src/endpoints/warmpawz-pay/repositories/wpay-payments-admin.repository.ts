import { query } from '../../../database/rds-connection';
import type { WpayPaymentsDateFilter } from '../admin/payments/dto/payments.requests';
import { buildWpayPaymentsDateFilterSql } from './wpay-payments-date-filter';

export const WPAY_ADMIN_PAYMENTS_MAX_EXPORT_ROWS = 5000;

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
};

const WPAY_PAYMENTS_BASE_WHERE = `
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
  s.settlement_breakup AS settlement_breakup
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

async function countWpayAdminPayments(dateFilter: WpayPaymentsDateFilter): Promise<number> {
  const { sql, params } = buildWpayPaymentsDateFilterSql(dateFilter, 1);
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM payments p
     WHERE ${WPAY_PAYMENTS_BASE_WHERE}${sql}`,
    params,
  );
  return Number((countResult.rows[0] as { total?: number })?.total ?? 0);
}

async function selectWpayAdminPayments(params: {
  dateFilter: WpayPaymentsDateFilter;
  limit?: number;
  offset?: number;
}): Promise<WpayAdminPaymentDbRow[]> {
  const { sql, params: filterParams, nextParamIndex } = buildWpayPaymentsDateFilterSql(
    params.dateFilter,
    1,
  );
  const queryParams = [...filterParams];
  let limitSql = '';
  let paramIndex = nextParamIndex;

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
     WHERE ${WPAY_PAYMENTS_BASE_WHERE}${sql}
     ORDER BY p.completed_at DESC, p.id DESC${limitSql}`,
    queryParams,
  );

  return result.rows as WpayAdminPaymentDbRow[];
}

export async function dbWpayAdminPaymentsPage(params: {
  page: number;
  pageSize: number;
  dateFilter: WpayPaymentsDateFilter;
}): Promise<{ rows: WpayAdminPaymentDbRow[]; total: number }> {
  const total = await countWpayAdminPayments(params.dateFilter);
  const offset = (params.page - 1) * params.pageSize;
  const rows = await selectWpayAdminPayments({
    dateFilter: params.dateFilter,
    limit: params.pageSize,
    offset,
  });
  return { rows, total };
}

export async function dbWpayAdminPaymentsExport(
  dateFilter: WpayPaymentsDateFilter,
): Promise<WpayAdminPaymentDbRow[]> {
  const total = await countWpayAdminPayments(dateFilter);
  if (total > WPAY_ADMIN_PAYMENTS_MAX_EXPORT_ROWS) {
    throw new WpayPaymentsExportTooLargeError(total);
  }
  return selectWpayAdminPayments({ dateFilter });
}
