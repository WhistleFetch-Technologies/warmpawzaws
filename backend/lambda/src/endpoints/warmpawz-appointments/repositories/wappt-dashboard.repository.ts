import { query } from '../../../database/rds-connection';
import { PUBLISHED } from '../constants/publish-status';
import { resolveMerchantDisplayName } from '../shared/merchant/merchant-display-name.resolver';
import { WAPPT_BOOKING_MODE } from '../shared/wappt-booking-preflight';

/** SQL fragment: bookings that belong to Warmpawz Appointments (tagged or catalogue fee match). */
const WAPPT_BOOKING_FILTER_SQL = `
  (
    b.commerce_mode = '${WAPPT_BOOKING_MODE}'
    OR (
      wappt.vendor_id IS NOT NULL
      AND ABS(COALESCE(b.base_price, 0) - COALESCE(wappt.appointment_fee, 0)) < 0.02
    )
  )`;

const WAPPT_CATALOGUE_JOIN_SQL = `
  LEFT JOIN warmpawz_appointments_vendor_catalog wappt
    ON wappt.vendor_id = b.vendor_id
   AND wappt.publish_status = '${PUBLISHED}'`;

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
  /** Wallet / cashback applied on the appointment fee payment. */
  readonly walletAmount?: number;
  /** Promo-engine instant discount on the linked payment when present. */
  readonly engineDiscountAmount?: number;
  readonly evaluationId?: string | null;
  readonly pendingCashback?: number;
  readonly awardedCashback?: number;
  readonly createdAt: string;
}

function readPromoReconFromPaymentMeta(metaRaw: unknown): {
  evaluationId: string | null;
  engineDiscountAmount: number;
  pendingCashback: number;
  awardedCashback: number;
} {
  let meta: Record<string, unknown> = {};
  if (metaRaw && typeof metaRaw === 'object') {
    meta = metaRaw as Record<string, unknown>;
  } else if (typeof metaRaw === 'string' && metaRaw.trim()) {
    try {
      meta = JSON.parse(metaRaw) as Record<string, unknown>;
    } catch {
      meta = {};
    }
  }
  const pe =
    meta.promoEngine && typeof meta.promoEngine === 'object'
      ? (meta.promoEngine as Record<string, unknown>)
      : {};
  const evaluationId =
    (meta.evaluationId != null && String(meta.evaluationId).trim()) ||
    (pe.evaluationId != null && String(pe.evaluationId).trim()) ||
    null;
  const engineDiscountAmount =
    Number(meta.quotedDiscountAmount ?? pe.engineDiscount ?? meta.discountAmount ?? 0) || 0;
  const pendingCashback = Number(pe.pendingCashback ?? meta.pendingCashback ?? 0) || 0;
  const awardedCashback = Number(pe.awardedCashback ?? meta.awardedCashback ?? 0) || 0;
  return {
    evaluationId: evaluationId || null,
    engineDiscountAmount,
    pendingCashback,
    awardedCashback,
  };
}

async function fetchWapptAppointmentRevenue(): Promise<number> {
  try {
    const revenueRes = await query(
      `SELECT COALESCE(SUM(COALESCE(b.total_amount, b.base_price, 0)), 0)::float AS total_revenue
       FROM bookings b
       ${WAPPT_CATALOGUE_JOIN_SQL}
       WHERE ${WAPPT_BOOKING_FILTER_SQL}
         AND (
           LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed')
           OR LOWER(COALESCE(b.status, '')) IN ('confirmed', 'completed', 'in_progress')
         )`,
    );
    return Number(revenueRes.rows[0]?.total_revenue ?? 0);
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message ?? err);
    if (msg.includes('commerce_mode') && msg.includes('does not exist')) {
      console.error('[wappt-dashboard] commerce_mode column missing on bookings — run migration 1081_add_bookings_commerce_mode.sql');
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
         ${WAPPT_CATALOGUE_JOIN_SQL}
         WHERE ${WAPPT_BOOKING_FILTER_SQL}`,
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
           b.created_at,
           COALESCE(p.wallet_amount_used, 0) AS wallet_amount,
           COALESCE(p.discount_amount, 0) AS payment_discount_amount,
           p.metadata AS payment_metadata
         FROM bookings b
         INNER JOIN customers c ON c.id = b.customer_id
         INNER JOIN vendors v ON v.id = b.vendor_id
         ${WAPPT_CATALOGUE_JOIN_SQL}
         LEFT JOIN LATERAL (
           SELECT wallet_amount_used, discount_amount, metadata
           FROM payments
           WHERE booking_id = b.id
             AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid', 'captured')
           ORDER BY completed_at DESC NULLS LAST, created_at DESC
           LIMIT 1
         ) p ON true
         WHERE ${WAPPT_BOOKING_FILTER_SQL}
         ORDER BY b.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message ?? err);
    if (msg.includes('commerce_mode') && msg.includes('does not exist')) {
      console.error('[wappt-dashboard] commerce_mode column missing on bookings — run migration 1081_add_bookings_commerce_mode.sql');
      return { rows: [], total: 0 };
    }
    throw err;
  }

  const rows = (listRes.rows as Array<Record<string, unknown>>).map((row) => {
    const promo = readPromoReconFromPaymentMeta(row.payment_metadata);
    const paymentDiscount = Number(row.payment_discount_amount) || 0;
    return {
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
      walletAmount: Number(row.wallet_amount) || 0,
      engineDiscountAmount: promo.engineDiscountAmount || paymentDiscount,
      evaluationId: promo.evaluationId,
      pendingCashback: promo.pendingCashback,
      awardedCashback: promo.awardedCashback,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  });

  return {
    rows,
    total: Number(countRes.rows[0]?.total ?? 0),
  };
}
