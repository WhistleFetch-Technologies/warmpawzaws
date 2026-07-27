import { query } from '../../../database/rds-connection';

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
};

export async function dbWpayAdminPaymentsPage(params: {
  page: number;
  pageSize: number;
}): Promise<{ rows: WpayAdminPaymentDbRow[]; total: number }> {
  const offset = (params.page - 1) * params.pageSize;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM payments p
     WHERE p.payment_source = 'warmpawz_pay'
       AND p.payment_status = 'completed'
       AND p.completed_at IS NOT NULL`,
  );
  const total = Number((countResult.rows[0] as { total?: number })?.total ?? 0);

  const result = await query(
    `SELECT
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
       p.completed_at AS paid_at
     FROM payments p
     INNER JOIN customers c ON c.id = p.customer_id
     INNER JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE p.payment_source = 'warmpawz_pay'
       AND p.payment_status = 'completed'
       AND p.completed_at IS NOT NULL
     ORDER BY p.completed_at DESC, p.id DESC
     LIMIT $1 OFFSET $2`,
    [params.pageSize, offset],
  );

  return { rows: result.rows as WpayAdminPaymentDbRow[], total };
}
