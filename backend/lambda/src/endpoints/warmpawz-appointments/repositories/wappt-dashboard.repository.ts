import { query } from '../../../database/rds-connection';
import { PUBLISHED } from '../constants/publish-status';
import { resolveMerchantDisplayName } from '../shared/merchant/merchant-display-name.resolver';

export interface WapptDashboardMetrics {
  readonly publishedVendorCount: number;
  readonly averageAppointmentFee: number;
  readonly totalRevenue: number;
}

export interface WapptAdminBookingRow {
  readonly bookingId: string;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly merchantDisplayName: string;
  readonly bookingDate: string;
  readonly bookingTime: string;
  readonly baseFeePaid: number;
  readonly createdAt: string;
}

async function fetchWapptAppointmentRevenue(): Promise<number> {
  try {
    const revenueRes = await query(
      `SELECT COALESCE(SUM(COALESCE(b.total_amount, b.base_price, 0)), 0)::float AS total_revenue
       FROM bookings b
       WHERE b.commerce_mode = 'warmpawz_appointments'
         AND (
           LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed')
           OR LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed', 'in_progress')
         )`,
    );
    return Number(revenueRes.rows[0]?.total_revenue ?? 0);
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message ?? err);
    // ponytail: dev may lag migration 1081 — metrics still useful without revenue
    if (msg.includes('commerce_mode')) {
      console.warn('[wappt-dashboard] commerce_mode column missing; revenue defaults to 0');
      return 0;
    }
    throw err;
  }
}

export async function fetchWapptDashboardMetrics(): Promise<WapptDashboardMetrics> {
  const [publishedRes, avgRes, totalRevenue] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count
       FROM warmpawz_appointments_vendor_catalog
       WHERE publish_status = $1`,
      [PUBLISHED],
    ),
    query(
      `SELECT COALESCE(AVG(appointment_fee), 0)::float AS avg_fee
       FROM warmpawz_appointments_vendor_catalog
       WHERE publish_status = $1 AND appointment_fee > 0`,
      [PUBLISHED],
    ),
    fetchWapptAppointmentRevenue(),
  ]);

  return {
    publishedVendorCount: Number(publishedRes.rows[0]?.count ?? 0),
    averageAppointmentFee: Number(avgRes.rows[0]?.avg_fee ?? 0),
    totalRevenue,
  };
}

export async function listWapptAdminBookings(params: {
  page: number;
  pageSize: number;
}): Promise<{ rows: WapptAdminBookingRow[]; total: number }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const offset = (page - 1) * pageSize;

  let countRes: { rows: Array<{ total?: number }> };
  let listRes: { rows: Array<Record<string, unknown>> };
  try {
    [countRes, listRes] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
         FROM bookings b
         WHERE b.commerce_mode = 'warmpawz_appointments'`,
      ),
      query(
        `SELECT
           b.id AS booking_id,
           c.full_name AS customer_name,
           c.phone AS customer_phone,
           v.business_name,
           v.owner_name,
           b.booking_date,
           b.booking_time,
           COALESCE(b.total_amount, b.base_price, 0) AS base_fee_paid,
           b.created_at
         FROM bookings b
         INNER JOIN customers c ON c.id = b.customer_id
         INNER JOIN vendors v ON v.id = b.vendor_id
         WHERE b.commerce_mode = 'warmpawz_appointments'
         ORDER BY b.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message ?? err);
    if (msg.includes('commerce_mode')) {
      console.warn('[wappt-dashboard] commerce_mode column missing; bookings list empty');
      return { rows: [], total: 0 };
    }
    throw err;
  }

  const rows = (listRes.rows as Array<Record<string, unknown>>).map((row) => ({
    bookingId: String(row.booking_id),
    customerName: row.customer_name != null ? String(row.customer_name) : null,
    customerPhone: row.customer_phone != null ? String(row.customer_phone) : null,
    merchantDisplayName: resolveMerchantDisplayName({
      businessName: row.business_name as string | null,
      ownerName: row.owner_name as string | null,
    }),
    bookingDate: String(row.booking_date),
    bookingTime: String(row.booking_time),
    baseFeePaid: Number(row.base_fee_paid) || 0,
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));

  return {
    rows,
    total: Number(countRes.rows[0]?.total ?? 0),
  };
}
