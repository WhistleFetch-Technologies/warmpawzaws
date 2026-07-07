/**
 * ============================================================================
 * VENDOR DASHBOARD ENHANCED ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Comprehensive vendor dashboard with:
 * - Real-time appointment data
 * - Revenue tracking
 * - Payout management
 * - Dashboard statistics and analytics
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../../../database/rds-connection';
import { resolveVendorId, resolveVendorIdsForLedger } from '../../../utils/vendor-resolve';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { MIN_VENDOR_PAYOUT_REQUEST_AMOUNT_INR } from '../../../lib/constants/vendor-payout';
import {
  backfillMissingVendorEarningsForVendorIds,
  realignPendingVendorEarningsForVendorIds,
} from '../../../utils/vendor-earnings-on-completion';
import {
  backfillMissingMealDeliverySettlementsForVendorIds,
  sumPendingDeliverySettlementNetPayout,
  sumTransferredDeliverySettlementNetPayout,
} from '../../../utils/meal-order-settlement';
import {
  getTemporaryVendorSuppressionParams,
  shouldHideSettlementRowFromAdminUi,
  sqlAndExcludeSuppressedBookingRows,
  sqlExcludeSuppressedSettlementRows,
  sqlExcludeSuppressedVendorCreatedRows,
  sqlExcludeSuppressedVendorEarningsRows,
} from '../../../utils/temporary-vendor-ui-suppression';
import { resolveVendorDashboardTimeframeRange } from '../../../utils/vendor-dashboard-timeframe';

/** Last 7 local calendar days with summed vendor_earnings amounts (for vendor earnings chart). */
/** Map delivery_settlements.status to vendor_earnings-like status for dashboard summaries. */
function mapDeliverySettlementLedgerStatus(raw: string | undefined | null): string {
  const k = String(raw || '').toLowerCase();
  if (k === 'transferred') return 'paid_out';
  if (k === 'processing') return 'settled';
  if (k === 'failed') return 'cancelled';
  return 'pending';
}

/** Ignore NaN/null DB numerics so one bad settlement row cannot zero the whole earnings summary. */
function safeMoneyAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const EARNINGS_PERIOD_TZ = 'Asia/Kolkata';

function formatYmdInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** SQL predicate: realized/delivery timestamp within earnings period (IST calendar boundaries). */
function sqlTimestampInEarningsPeriod(period: string, columnExpr: string): string {
  const col = columnExpr;
  switch (period) {
    case 'day':
      return `(${col} IS NOT NULL AND ${col} >= (timezone('${EARNINGS_PERIOD_TZ}', now()))::date::timestamp AT TIME ZONE '${EARNINGS_PERIOD_TZ}' AND ${col} < ((timezone('${EARNINGS_PERIOD_TZ}', now()))::date + interval '1 day')::timestamp AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    case 'week':
      return `(${col} IS NOT NULL AND ${col} >= ((timezone('${EARNINGS_PERIOD_TZ}', now()))::date - interval '6 days')::timestamp AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    case 'month':
      return `(${col} IS NOT NULL AND ${col} >= date_trunc('month', timezone('${EARNINGS_PERIOD_TZ}', now())) AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    case 'year':
      return `(${col} IS NOT NULL AND ${col} >= date_trunc('year', timezone('${EARNINGS_PERIOD_TZ}', now())) AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    default:
      return 'TRUE';
  }
}

function buildDailyBreakdownLast7Days(
  earningsRows: Array<{ realized_at?: string | null; amount?: string | number | null }>,
  ref: Date = new Date()
): Array<{ day: string; date: string; amount: number }> {
  const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const byKey = new Map<string, number>();
  for (const e of earningsRows) {
    if (!e?.realized_at) continue;
    const k = formatYmdInTimeZone(new Date(e.realized_at), EARNINGS_PERIOD_TZ);
    const a = parseFloat(String(e.amount ?? '0'));
    if (!Number.isFinite(a)) continue;
    byKey.set(k, (byKey.get(k) || 0) + a);
  }
  const out: Array<{ day: string; date: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref.getTime() - i * 24 * 60 * 60 * 1000);
    const key = formatYmdInTimeZone(d, EARNINGS_PERIOD_TZ);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: EARNINGS_PERIOD_TZ, weekday: 'short' }).format(d);
    const raw = byKey.get(key) || 0;
    const amt = Math.round(raw * 100) / 100;
    out.push({ day: weekday.slice(0, 3), date: key, amount: amt });
  }
  return out;
}

const VENDOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vendor ids to include when reading vendor_earnings — matches GET /vendor/bookings/:id center logic
 * so clinic/center earnings stored under sibling vendor rows still appear for the logged-in account.
 */
async function expandVendorIdsForEarningsContext(paramVendorId: string): Promise<string[]> {
  return resolveVendorIdsForLedger(paramVendorId);
}

export function registerVendorDashboardEnhancedEndpoints(app: Hono) {
  /**
   * GET /vendor/dashboard/:vendorId
   * Get comprehensive vendor dashboard data
   */
  app.get("/vendor/dashboard/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'today'; // today, week, month

      // Handle test IDs - return empty dashboard
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            vendorId,
            fullName: 'Vendor',
            businessName: null,
            vendorType: 'service_provider',
            serviceStyle: 'both',
            address: 'Location not set',
            isActive: false,
          },
          stats: {
            appointments: 0,
            consultations: 0,
            earnings: 0,
            pendingEarnings: 0,
            completedServices: 0,
            /** Aligned with GET /vendor/:vendorId/dashboard: no aggregate when there are no approved reviews. */
            rating: null,
            totalReviews: 0,
          },
          bookings: [],
          timeframe,
        });
      }

      const resolvedVendorId = await resolveVendorId(vendorId);
      const vendorIds = [resolvedVendorId];
      if (vendorId !== resolvedVendorId) vendorIds.push(vendorId);

      console.log(`📊 [DASHBOARD] Fetching dashboard for vendor: ${vendorId} (resolved: ${resolvedVendorId}), timeframe: ${timeframe}`);

      const vendors = await select('vendors', { id: resolvedVendorId });
      const vendor = vendors.length > 0 ? vendors[0] : null;

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const { startDate: startDateStr, endDate: endDateStr } = resolveVendorDashboardTimeframeRange(
        timeframe,
        today
      );

      const tb = getTemporaryVendorSuppressionParams();
      const bookSupp1 = sqlAndExcludeSuppressedBookingRows('b', tb ? 4 : undefined, tb ? 5 : undefined);
      const bookSupp2 = sqlAndExcludeSuppressedBookingRows('b', tb ? 5 : undefined, tb ? 6 : undefined);
      const bookSuppTail = tb ? [tb.vendorIds, tb.cutoffDateIst] : [];
      const bookings = vendorIds.length === 1
        ? await query(
            `SELECT b.*,
                    COALESCE(s.name, vs.service_name, sc.service_name, sc.display_name) as service_name,
                    COALESCE(s.category, vs.category, sc.category_id::text) as service_category,
                    c.full_name as customer_name,
                    c.phone as customer_phone
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN vendor_services vs ON vs.id = b.service_id
             LEFT JOIN service_catalog sc ON sc.id = b.service_id
             LEFT JOIN customers c ON b.customer_id = c.id
             WHERE b.vendor_id = $1 
               AND b.booking_date >= $2
               AND b.booking_date <= $3
               AND b.status != 'pending_payment'
               AND b.status != 'cancelled'
               ${bookSupp1}
             ORDER BY b.booking_date ASC, b.booking_time ASC`,
            [resolvedVendorId, startDateStr, endDateStr, ...bookSuppTail]
          ).catch(() => ({ rows: [] }))
        : await query(
            `SELECT b.*,
                    COALESCE(s.name, vs.service_name, sc.service_name, sc.display_name) as service_name,
                    COALESCE(s.category, vs.category, sc.category_id::text) as service_category,
                    c.full_name as customer_name,
                    c.phone as customer_phone
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN vendor_services vs ON vs.id = b.service_id
             LEFT JOIN service_catalog sc ON sc.id = b.service_id
             LEFT JOIN customers c ON b.customer_id = c.id
             WHERE (b.vendor_id = $1 OR b.vendor_id = $2)
               AND b.booking_date >= $3
               AND b.booking_date <= $4
               AND b.status != 'pending_payment'
               AND b.status != 'cancelled'
               ${bookSupp2}
             ORDER BY b.booking_date ASC, b.booking_time ASC`,
            [vendorIds[0], vendorIds[1], startDateStr, endDateStr, ...bookSuppTail]
          ).catch(() => ({ rows: [] }));

      // Calculate stats (bookings)
      const stats = {
        appointments: 0,
        consultations: 0,
        earnings: 0,
        pendingEarnings: 0,
        completedServices: 0,
        rating: null as number | null,
        totalReviews: 0,
      };

      for (const booking of bookings.rows) {
        if (['confirmed', 'pending', 'in_progress'].includes(booking.status)) {
          stats.appointments++;
        }

        if (booking.status === 'completed') {
          stats.completedServices++;
          stats.consultations++;
          stats.earnings += parseFloat(booking.total_amount || '0');
        }

        if (['in_progress', 'confirmed'].includes(booking.status)) {
          stats.pendingEarnings += parseFloat(booking.total_amount || '0');
        }
      }

      // Approved reviews only, same vendor_id scope as GET /vendor/:vendorId/dashboard
      const ratingQuery =
        vendorIds.length === 1
          ? `SELECT AVG(rating) as rating, COUNT(*)::int as total_reviews FROM reviews WHERE vendor_id = $1 AND is_approved = true`
          : `SELECT AVG(rating) as rating, COUNT(*)::int as total_reviews FROM reviews WHERE (vendor_id = $1 OR vendor_id = $2) AND is_approved = true`;
      const ratingStats = await query(ratingQuery, vendorIds).catch(() => ({
        rows: [{ rating: null, total_reviews: 0 }],
      }));
      const ratingRow = ratingStats.rows[0];
      const totalReviewsDash = parseInt(String(ratingRow?.total_reviews ?? '0'), 10);
      const avgDash =
        ratingRow?.rating != null && ratingRow.rating !== ''
          ? parseFloat(String(ratingRow.rating))
          : NaN;
      const statsRating =
        totalReviewsDash > 0 && Number.isFinite(avgDash) ? parseFloat(avgDash.toFixed(1)) : null;
      stats.rating = statsRating;
      stats.totalReviews = totalReviewsDash;

      // ✅ FIX: Include enriched bookings in response
      const enrichedBookings = bookings.rows.map((b: any) => ({
        id: b.id,
        booking_id: b.id,
        customer_id: b.customer_id,
        customer_name: b.customer_name || 'Customer',
        customer_phone: b.customer_phone,
        service_id: b.service_id,
        service_name: b.service_name || 'Service',
        service_category: b.service_category,
        booking_date: b.booking_date,
        booking_time: b.booking_time,
        status: b.status,
        payment_status: b.payment_status,
        total_amount: b.total_amount,
        otp_code: b.otp_code,
        otp_verified: b.otp_verified,
        service_type: b.service_type,
        service_style: b.service_style,
        notes: b.notes,
      }));

      return c.json({
        success: true,
        vendor: vendor ? {
          vendorId: vendor.id,
          fullName: vendor.owner_name,
          businessName: vendor.business_name,
          vendorType: vendor.category,
          serviceStyle: vendor.metadata?.serviceStyle || 'both',
          address: vendor.address,
          phone: vendor.phone,
          email: vendor.email,
          isActive: vendor.is_active,
        } : {
          vendorId,
          fullName: 'Vendor',
          businessName: null,
          vendorType: 'service_provider',
          serviceStyle: 'both',
          address: 'Location not set',
          isActive: false,
        },
        stats,
        bookings: enrichedBookings, // ✅ Always include so vendor dashboard shows placeholders post-migration
        timeframe,
      });
    } catch (error: any) {
      console.error('Error fetching vendor dashboard:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/dashboard
   * Alternative route pattern for frontend compatibility.
   * Uses resolveVendorId so both identity-id and vendor-id bookings are returned (fixes center/clinic "Appointment not found").
   */
  app.get("/vendor/:vendorId/dashboard", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'today';

      // Handle test IDs - return empty dashboard
      if (paramVendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramVendorId)) {
        return c.json({
          success: true,
          stats: {
            todayBookings: 0,
            pendingBookings: 0,
            completedToday: 0,
            earnings: 0,
            pendingSettlement: 0,
            rating: null,
            totalReviews: 0,
          },
          bookings: [],
        });
      }

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      const vendorIds = [resolvedVendorId];
      if (paramVendorId !== resolvedVendorId) vendorIds.push(paramVendorId);

      console.log(`📊 [DASHBOARD] Fetching dashboard for vendor: ${paramVendorId} (resolved: ${resolvedVendorId}), timeframe: ${timeframe}`);

      // Get vendor (post-role-migration: still return bookings so dashboard shows placeholders)
      const vendors = await select('vendors', { id: resolvedVendorId });
      const vendor = vendors.length > 0 ? vendors[0] : null;

      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      const { startDate: startDateStr, endDate: endDateStr } = resolveVendorDashboardTimeframeRange(
        timeframe,
        today
      );
      const temporarySuppressionMain = getTemporaryVendorSuppressionParams();
      const supMainTail = temporarySuppressionMain
        ? [temporarySuppressionMain.vendorIds, temporarySuppressionMain.cutoffDateIst]
        : [];
      const mainStatFrag1 = sqlAndExcludeSuppressedBookingRows(
        'b',
        temporarySuppressionMain ? 4 : undefined,
        temporarySuppressionMain ? 5 : undefined,
      );
      const mainStatFrag2 = sqlAndExcludeSuppressedBookingRows(
        'b',
        temporarySuppressionMain ? 5 : undefined,
        temporarySuppressionMain ? 6 : undefined,
      );

      // Get bookings stats scoped to the selected timeframe
      const [statsParam1, statsParam2] = vendorIds.length >= 2 ? [vendorIds[0], vendorIds[1]] : [vendorIds[0], vendorIds[0]];
      const bookingsStatsQuery = vendorIds.length === 1
        ? `SELECT 
          COUNT(*) FILTER (WHERE b.booking_date >= $1 AND b.booking_date <= $2 AND b.status IN ('pending', 'confirmed', 'in_progress')) as today_bookings,
          COUNT(*) FILTER (WHERE b.booking_date >= $1 AND b.booking_date <= $2 AND b.status IN ('pending', 'confirmed', 'in_progress')) as pending_bookings,
          COUNT(*) FILTER (WHERE b.booking_date >= $1 AND b.booking_date <= $2 AND b.status = 'completed') as completed_today
        FROM bookings b
        WHERE b.vendor_id = $3${mainStatFrag1}`
        : `SELECT 
          COUNT(*) FILTER (WHERE b.booking_date >= $1 AND b.booking_date <= $2 AND b.status IN ('pending', 'confirmed', 'in_progress')) as today_bookings,
          COUNT(*) FILTER (WHERE b.booking_date >= $1 AND b.booking_date <= $2 AND b.status IN ('pending', 'confirmed', 'in_progress')) as pending_bookings,
          COUNT(*) FILTER (WHERE b.booking_date >= $1 AND b.booking_date <= $2 AND b.status = 'completed') as completed_today
        FROM bookings b
        WHERE (b.vendor_id = $3 OR b.vendor_id = $4)${mainStatFrag2}`;
      const bookingsStatsParams =
        vendorIds.length === 1
          ? [startDateStr, endDateStr, statsParam1, ...supMainTail]
          : [startDateStr, endDateStr, statsParam1, statsParam2, ...supMainTail];
      const bookingsStats = await query(bookingsStatsQuery, bookingsStatsParams).catch(() => ({ rows: [{ today_bookings: '0', pending_bookings: '0', completed_today: '0' }] }));

      // Prefer vendor_earnings (source of truth) when available; fallback to bookings
      const hasVendorEarnings = await query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_earnings') as ex`
      ).then((r) => r.rows[0]?.ex).catch(() => false);

      let earningsFromTable = { earnings: '0', pending_settlement: '0' };
      if (hasVendorEarnings) {
        let veIds = await expandVendorIdsForEarningsContext(paramVendorId);
        if (veIds.length === 0) veIds = [resolvedVendorId];
        await backfillMissingVendorEarningsForVendorIds(veIds, '[DASHBOARD-EARNINGS-BACKFILL]');
        const veSupSql = temporarySuppressionMain
          ? ` AND ${sqlExcludeSuppressedVendorEarningsRows('ve', 2, 3)}`
          : '';
        const veRes = await query(
          `SELECT 
             COALESCE(SUM(amount), 0) as earnings,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_settlement
           FROM vendor_earnings ve
           WHERE ve.vendor_id = ANY($1::uuid[])${veSupSql}`,
          [veIds, ...(temporarySuppressionMain ? [temporarySuppressionMain.vendorIds, temporarySuppressionMain.cutoffDateIst] : [])]
        ).catch(() => ({ rows: [{ earnings: '0', pending_settlement: '0' }] }));
        earningsFromTable = veRes.rows[0] || earningsFromTable;
      }

      const bkFrag1 = sqlAndExcludeSuppressedBookingRows(
        'bk',
        temporarySuppressionMain ? 2 : undefined,
        temporarySuppressionMain ? 3 : undefined,
      );
      const bkFrag2 = sqlAndExcludeSuppressedBookingRows(
        'bk',
        temporarySuppressionMain ? 3 : undefined,
        temporarySuppressionMain ? 4 : undefined,
      );
      const earningsQuery = vendorIds.length === 1
        ? `SELECT COALESCE(SUM(total_amount), 0) as earnings, COALESCE(SUM(CASE WHEN status = 'completed' AND (settlement_status IS NULL OR settlement_status != 'settled') THEN total_amount ELSE 0 END), 0) as pending_settlement FROM bookings bk WHERE bk.vendor_id = $1 AND bk.status = 'completed'${bkFrag1}`
        : `SELECT COALESCE(SUM(total_amount), 0) as earnings, COALESCE(SUM(CASE WHEN status = 'completed' AND (settlement_status IS NULL OR settlement_status != 'settled') THEN total_amount ELSE 0 END), 0) as pending_settlement FROM bookings bk WHERE (bk.vendor_id = $1 OR bk.vendor_id = $2) AND bk.status = 'completed'${bkFrag2}`;
      const earningsStats = await query(
        earningsQuery,
        vendorIds.length === 1
          ? [statsParam1, ...supMainTail]
          : [statsParam1, statsParam2, ...supMainTail]
      ).catch(() => ({ rows: [{ earnings: '0', pending_settlement: '0' }] }));
      const earningsFromBookings = earningsStats.rows[0] || { earnings: '0', pending_settlement: '0' };

      // Use vendor_earnings when available for consistency with earnings API and payout flow
      const earnings = hasVendorEarnings
        ? { earnings: earningsFromTable.earnings, pending_settlement: earningsFromTable.pending_settlement }
        : earningsFromBookings;

      const ratingQuery = vendorIds.length === 1
        ? `SELECT AVG(rating) as rating, COUNT(*)::int as total_reviews FROM reviews WHERE vendor_id = $1 AND is_approved = true`
        : `SELECT AVG(rating) as rating, COUNT(*)::int as total_reviews FROM reviews WHERE (vendor_id = $1 OR vendor_id = $2) AND is_approved = true`;
      const ratingStats = await query(ratingQuery, vendorIds).catch(() => ({ rows: [{ rating: null, total_reviews: 0 }] }));

      const stats = bookingsStats.rows[0];
      const rating = ratingStats.rows[0];
      const totalReviewsDash = parseInt(String(rating?.total_reviews ?? '0'), 10);
      const avgDash =
        rating?.rating != null && rating.rating !== ''
          ? parseFloat(String(rating.rating))
          : NaN;
      const statsRating =
        totalReviewsDash > 0 && Number.isFinite(avgDash)
          ? parseFloat(avgDash.toFixed(1))
          : null;

      // Get bookings for display within the selected timeframe
      const listSup1 = sqlAndExcludeSuppressedBookingRows(
        'b',
        temporarySuppressionMain ? 4 : undefined,
        temporarySuppressionMain ? 5 : undefined,
      );
      const listSup2 = sqlAndExcludeSuppressedBookingRows(
        'b',
        temporarySuppressionMain ? 5 : undefined,
        temporarySuppressionMain ? 6 : undefined,
      );

      const bookingsQuery = vendorIds.length === 1
        ? `SELECT b.*,
                COALESCE(s.name, vs.service_name, sc.service_name, sc.display_name) as service_name,
                COALESCE(s.category, vs.category, sc.category_id::text) as service_category,
                c.full_name as customer_name,
                c.phone as customer_phone
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN vendor_services vs ON vs.id = b.service_id
         LEFT JOIN service_catalog sc ON sc.id = b.service_id
         LEFT JOIN customers c ON b.customer_id = c.id
         WHERE b.vendor_id = $1 
           AND b.booking_date >= $2
           AND b.booking_date <= $3
           AND b.status != 'pending_payment'
           AND b.status != 'cancelled'
           ${listSup1}
         ORDER BY b.booking_date ASC, b.booking_time ASC`
        : `SELECT b.*,
                COALESCE(s.name, vs.service_name, sc.service_name, sc.display_name) as service_name,
                COALESCE(s.category, vs.category, sc.category_id::text) as service_category,
                c.full_name as customer_name,
                c.phone as customer_phone
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN vendor_services vs ON vs.id = b.service_id
         LEFT JOIN service_catalog sc ON sc.id = b.service_id
         LEFT JOIN customers c ON b.customer_id = c.id
         WHERE (b.vendor_id = $1 OR b.vendor_id = $2)
           AND b.booking_date >= $3
           AND b.booking_date <= $4
           AND b.status != 'pending_payment'
           AND b.status != 'cancelled'
           ${listSup2}
         ORDER BY b.booking_date ASC, b.booking_time ASC`;
      const bookingsParams =
        vendorIds.length === 1
          ? [resolvedVendorId, startDateStr, endDateStr, ...supMainTail]
          : [vendorIds[0], vendorIds[1], startDateStr, endDateStr, ...supMainTail];
      const bookingsResult = await query(bookingsQuery, bookingsParams).catch(() => ({ rows: [] }));

      // Transform bookings for frontend
      const enrichedBookings = bookingsResult.rows.map((b: any) => ({
        id: b.id,
        booking_id: b.id,
        customer_id: b.customer_id,
        customer_name: b.customer_name || 'Customer',
        customer_phone: b.customer_phone,
        service_id: b.service_id,
        service_name: b.service_name || 'Service',
        service_category: b.service_category,
        booking_date: b.booking_date,
        booking_time: b.booking_time,
        status: b.status,
        payment_status: b.payment_status,
        total_amount: b.total_amount,
        otp_code: b.otp_code,
        otp_verified: b.otp_verified,
        service_type: b.service_type,
        service_style: b.service_style,
        notes: b.notes,
      }));

      console.log(`📊 [DASHBOARD] Returning ${enrichedBookings.length} bookings for vendor ${paramVendorId}`);

      return c.json({
        success: true,
        stats: {
          todayBookings: parseInt(stats.today_bookings || '0', 10),
          pendingBookings: parseInt(stats.pending_bookings || '0', 10),
          completedToday: parseInt(stats.completed_today || '0', 10),
          earnings: parseFloat(earnings.earnings || '0'),
          pendingSettlement: parseFloat(earnings.pending_settlement || '0'),
          rating: statsRating,
          totalReviews: totalReviewsDash,
        },
        bookings: enrichedBookings, // ✅ Include sorted bookings
        timeframe,
      });
    } catch (error: any) {
      console.error('Error fetching vendor dashboard:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/analytics
   * Get comprehensive analytics for vendor
   * ✅ Resolves vendor_identity id → vendors.id so dashboard works when app sends identity id
   */
  app.get("/vendor/:vendorId/analytics", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year, all

      // Resolve identity id to vendor id (same as dashboard and vendor-services)
      const vendorId = await resolveVendorId(paramVendorId);
      console.log(`📊 [ANALYTICS] Fetching analytics for vendor: ${paramVendorId} (resolved: ${vendorId}), period: ${period}`);

      // Get vendor by resolved id; if no vendor row (e.g. new vendor / identity-only), return empty analytics instead of 404
      const vendors = await select('vendors', { id: vendorId });
      const hasVendorRow = vendors.length > 0;

      // Calculate period start
      const now = new Date();
      let periodStart = new Date();

      switch (period) {
        case 'day':
          periodStart.setHours(0, 0, 0, 0);
          break;
        case 'week':
          periodStart.setDate(now.getDate() - 7);
          break;
        case 'month':
          periodStart.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          periodStart.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
          periodStart = new Date(0);
          break;
      }

      if (!hasVendorRow) {
        const emptyOverview = {
          totalEarnings: 0,
          avgBookingValue: 0,
          totalBookings: 0,
          completed: 0,
          uniqueCustomers: 0,
          returningCustomers: 0,
          avgRating: 'N/A',
          reviewCount: 0,
          completionRate: 0,
          cancellationRate: 0,
          customerRetentionRate: 0,
        };
        return c.json({
          success: true,
          analytics: {
            totalBookings: 0,
            completed: 0,
            cancelled: 0,
            pending: 0,
            confirmed: 0,
            totalRevenue: 0,
            averageBookingValue: 0,
            completionRate: 0,
            cancellationRate: 0,
            rating: 0,
            totalReviews: 0,
            overview: emptyOverview,
          },
          period,
        });
      }

      // Get bookings (use resolved vendor id)
      const analyticSup = getTemporaryVendorSuppressionParams();
      const analyticBookFrag = sqlAndExcludeSuppressedBookingRows(
        'b',
        analyticSup ? 3 : undefined,
        analyticSup ? 4 : undefined,
      );
      const bookings = await query(
        `SELECT * FROM bookings b
         WHERE b.vendor_id = $1 
           AND b.created_at >= $2
           ${analyticBookFrag}
         ORDER BY b.created_at DESC`,
        [vendorId, periodStart.toISOString(), ...(analyticSup ? [analyticSup.vendorIds, analyticSup.cutoffDateIst] : [])]
      ).catch(() => ({ rows: [] }));

      // Calculate analytics
      const analytics = {
        totalBookings: bookings.rows.length,
        completed: bookings.rows.filter((b: any) => b.status === 'completed').length,
        cancelled: bookings.rows.filter((b: any) => b.status === 'cancelled').length,
        pending: bookings.rows.filter((b: any) => b.status === 'pending').length,
        confirmed: bookings.rows.filter((b: any) => b.status === 'confirmed').length,
        totalRevenue: bookings.rows
          .filter((b: any) => b.status === 'completed')
          .reduce((sum: number, b: any) => sum + parseFloat(b.total_amount || '0'), 0),
        averageBookingValue: 0,
        completionRate: 0,
        cancellationRate: 0,
      };

      if (analytics.totalBookings > 0) {
        analytics.averageBookingValue = analytics.totalRevenue / analytics.completed || 0;
        analytics.completionRate = (analytics.completed / analytics.totalBookings) * 100;
        analytics.cancellationRate = (analytics.cancelled / analytics.totalBookings) * 100;
      }

      // Get reviews
      const reviews = await query(
        'SELECT * FROM reviews WHERE vendor_id = $1',
        [vendorId]
      ).catch(() => ({ rows: [] }));

      const rating = reviews.rows.length > 0
        ? reviews.rows.reduce((sum: number, r: any) => sum + parseFloat(r.rating || '0'), 0) / reviews.rows.length
        : 0;
      const ratingRounded = parseFloat(rating.toFixed(1));
      const totalReviews = reviews.rows.length;

      // Unique and returning customers (from bookings in period)
      const customerIds = (bookings.rows as any[]).map((b: any) => b.customer_id).filter(Boolean);
      const uniqueSet = new Set(customerIds);
      const uniqueCustomers = uniqueSet.size;
      const countByCustomer: Record<string, number> = {};
      customerIds.forEach((id: string) => { countByCustomer[id] = (countByCustomer[id] || 0) + 1; });
      const returningCustomers = Object.values(countByCustomer).filter((c: number) => c > 1).length;
      const customerRetentionRate = uniqueCustomers > 0 ? (returningCustomers / uniqueCustomers) * 100 : 0;

      // Overview shape expected by vendor Analytics/Performance tab
      const overview = {
        totalEarnings: analytics.totalRevenue,
        avgBookingValue: analytics.averageBookingValue,
        totalBookings: analytics.totalBookings,
        completed: analytics.completed,
        uniqueCustomers,
        returningCustomers,
        avgRating: totalReviews > 0 ? ratingRounded : 'N/A',
        reviewCount: totalReviews,
        completionRate: analytics.completionRate,
        cancellationRate: analytics.cancellationRate,
        customerRetentionRate,
      };

      return c.json({
        success: true,
        analytics: {
          ...analytics,
          rating: totalReviews > 0 ? ratingRounded : null,
          totalReviews,
          overview,
        },
        period,
      });
    } catch (error: any) {
      console.error('Error fetching vendor analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/earnings
   * Get vendor earnings from vendor_earnings table with settlement status
   * ✅ NEW: Dedicated endpoint that reads from vendor_earnings table
   */
  app.get("/vendor/:vendorId/earnings", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year, lifetime

      // Handle test IDs
      if (paramVendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramVendorId)) {
        return c.json({
          success: true,
          earnings: {
            totalEarnings: 0,
            pendingSettlement: 0,
            settled: 0,
            paidOut: 0,
            thisPeriod: 0,
            transactions: [],
          },
        });
      }

      const vendorId = await resolveVendorId(paramVendorId);
      let vendorIdsForEarnings = await expandVendorIdsForEarningsContext(paramVendorId);
      if (vendorIdsForEarnings.length === 0) vendorIdsForEarnings = [vendorId];
      console.log(
        `💰 [EARNINGS] Fetching earnings for vendor: ${paramVendorId} (canonical: ${vendorId}, ledgerIds: ${vendorIdsForEarnings.join(',')}), period: ${period}`
      );

      const earningsBackfilled = await backfillMissingVendorEarningsForVendorIds(
        vendorIdsForEarnings,
        '[EARNINGS-BACKFILL]',
        500
      );
      await realignPendingVendorEarningsForVendorIds(
        vendorIdsForEarnings,
        100,
        '[EARNINGS-REALIGN]'
      );
      await backfillMissingMealDeliverySettlementsForVendorIds(
        vendorIdsForEarnings,
        '[EARNINGS-MEAL-SETTLEMENT-BACKFILL]',
      );

      const periodScoped = period !== 'lifetime';
      const vePeriodSql = periodScoped
        ? ` AND ${sqlTimestampInEarningsPeriod(period, 've.realized_at')}`
        : '';
      const dsDeliveredCol = 'COALESCE(ds.order_delivered_at, ds.created_at)';

      // Get vendor_earnings records (center-aware: align with GET /vendor/bookings/:id sibling vendors)
      const earnSupCtx = getTemporaryVendorSuppressionParams();
      const earnVeFragLifetime = earnSupCtx
        ? ` AND ${sqlExcludeSuppressedVendorEarningsRows('ve', 2, 3)}`
        : '';
      const earnVeFragRanged = earnSupCtx
        ? ` AND ${sqlExcludeSuppressedVendorEarningsRows('ve', 2, 3)}`
        : '';
      const earningsBookingSelect = `ve.*,
           b.booking_date,
           b.service_id,
           COALESCE(sc.display_name, sc.service_name, s.name, vs.service_name, 'Service') as service_name,
           c.full_name as customer_name`;
      const earningsBookingJoins = `
           LEFT JOIN bookings b ON ve.booking_id = b.id
           LEFT JOIN service_catalog sc ON b.service_id = sc.id
           LEFT JOIN services s ON b.service_id = s.id
           LEFT JOIN vendor_services vs ON b.service_id = vs.id
           LEFT JOIN customers c ON b.customer_id = c.id`;
      const earningsQuery =
        period === 'lifetime'
          ? `SELECT ${earningsBookingSelect}
           FROM vendor_earnings ve${earningsBookingJoins}
           WHERE ve.vendor_id = ANY($1::uuid[])${earnVeFragLifetime}
           ORDER BY ve.realized_at DESC NULLS LAST`
          : `SELECT ${earningsBookingSelect}
           FROM vendor_earnings ve${earningsBookingJoins}
           WHERE ve.vendor_id = ANY($1::uuid[])${vePeriodSql}${earnVeFragRanged}
           ORDER BY ve.realized_at DESC NULLS LAST`;

      const earningsResult = await query(
        earningsQuery,
        [vendorIdsForEarnings, ...(earnSupCtx ? [earnSupCtx.vendorIds, earnSupCtx.cutoffDateIst] : [])]
      );

      const earnings = earningsResult.rows || [];

      const dsPeriodSql = periodScoped
        ? ` AND ${sqlTimestampInEarningsPeriod(period, dsDeliveredCol)}`
        : '';
      const settlementsSql = `SELECT id, vendor_id, meal_order_id, pharmacy_order_id, order_amount, commission_amount, commission_rate,
                    net_payout, status, order_delivered_at, created_at, actual_payout_date
             FROM delivery_settlements
             WHERE vendor_id = ANY($1::uuid[])${dsPeriodSql}
             ORDER BY COALESCE(order_delivered_at, created_at) DESC`;

      const settlementsResult = await query(settlementsSql, [vendorIdsForEarnings]).catch(() => ({ rows: [] }));

      const settlementRows = settlementsResult.rows || [];

      // Calculate summary
      const summary = {
        totalEarnings: 0,
        pendingSettlement: 0,
        settled: 0,
        paidOut: 0,
        thisPeriod: 0,
        totalCommission: 0,
        totalRevenue: 0,
      };

      earnings.forEach((e: any) => {
        const amount = safeMoneyAmount(e.amount);
        const commission = safeMoneyAmount(e.commission_amount);
        const total = safeMoneyAmount(e.total_amount);

        summary.totalEarnings += amount;
        summary.totalCommission += commission;
        summary.totalRevenue += total;

        if (e.status === 'pending') {
          summary.pendingSettlement += amount;
        } else if (e.status === 'settled') {
          summary.settled += amount;
        } else if (e.status === 'paid_out') {
          summary.paidOut += amount;
        }

        if (period === 'lifetime') {
          if (e.realized_at) summary.thisPeriod += amount;
        } else {
          summary.thisPeriod += amount;
        }
      });

      settlementRows.forEach((ds: any) => {
        const ledgerStatus = mapDeliverySettlementLedgerStatus(ds.status);
        if (ledgerStatus === 'cancelled') return;

        const amount = safeMoneyAmount(ds.net_payout);
        const commission = safeMoneyAmount(ds.commission_amount);
        const total = safeMoneyAmount(ds.order_amount);

        summary.totalEarnings += amount;
        summary.totalCommission += commission;
        summary.totalRevenue += total;

        if (ledgerStatus === 'pending') {
          summary.pendingSettlement += amount;
        } else if (ledgerStatus === 'settled') {
          summary.settled += amount;
        } else if (ledgerStatus === 'paid_out') {
          summary.paidOut += amount;
        }

        if (period === 'lifetime') {
          const realizedAt = ds.order_delivered_at || ds.created_at;
          if (realizedAt) summary.thisPeriod += amount;
        } else {
          summary.thisPeriod += amount;
        }
      });

      // Get vendor info for bank verification status
      const vendors = await select('vendors', { id: vendorId });
      const vendor = vendors[0] || {};

      // Transform transactions (bookings + hyperlocal delivery settlements)
      const bookingTransactions = earnings.map((e: any) => ({
        id: e.id,
        bookingId: e.booking_id,
        bookingDate: e.booking_date,
        serviceName: e.service_name || 'Service',
        customerName: e.customer_name || 'Customer',
        amount: safeMoneyAmount(e.amount),
        commission: safeMoneyAmount(e.commission_amount),
        totalAmount: safeMoneyAmount(e.total_amount),
        commissionRate: safeMoneyAmount(e.commission_rate),
        status: e.status,
        realizedAt: e.realized_at,
        paidOutAt: e.paid_out_at,
        settlementId: e.settlement_id,
      }));

      const settlementTransactions = settlementRows.map((ds: any) => ({
        id: ds.id,
        bookingId: ds.meal_order_id || ds.pharmacy_order_id,
        bookingDate: ds.order_delivered_at || ds.created_at,
        serviceName: ds.meal_order_id ? 'Meal delivery' : ds.pharmacy_order_id ? 'Pharmacy delivery' : 'Delivery',
        amount: safeMoneyAmount(ds.net_payout),
        commission: safeMoneyAmount(ds.commission_amount),
        totalAmount: safeMoneyAmount(ds.order_amount),
        commissionRate: safeMoneyAmount(ds.commission_rate),
        status: mapDeliverySettlementLedgerStatus(ds.status),
        realizedAt: ds.order_delivered_at || ds.created_at,
        paidOutAt: ds.actual_payout_date || null,
        settlementId: ds.id,
      }));

      const transactions = [...bookingTransactions, ...settlementTransactions].sort(
        (a: any, b: any) =>
          new Date(b.realizedAt || 0).getTime() - new Date(a.realizedAt || 0).getTime(),
      );

      // ✅ Get pending tier deductions
      const deductionsResult = await query(
        `SELECT d.*, t.tier_name 
         FROM tier_upgrade_deductions d
         LEFT JOIN vendor_tiers t ON d.tier_id = t.id
         WHERE d.vendor_id = $1 AND d.status IN ('pending', 'in_progress')`,
        [vendorId]
      ).catch(() => ({ rows: [] }));
      
      const deductionRows = Array.isArray(deductionsResult) ? deductionsResult : deductionsResult.rows || [];
      const pendingTierDeduction = deductionRows.reduce(
        (sum: number, d: any) => sum + parseFloat(d.amount_remaining || '0'), 0
      );

      // Align with vendor dashboard: totalBookings, completedBookings, averageBookingValue (same semantics as admin)
      const totalBookings = transactions.length;
      const completedBookings = transactions.filter((t: any) => t.status === 'settled' || t.status === 'paid_out').length;
      const averageBookingValue = totalBookings > 0 ? summary.totalEarnings / totalBookings : 0;

      // Use computed total from vendor_earnings for lifetime so completed bookings show immediately
      const totalEarningsLifetime = period === 'lifetime' ? summary.totalEarnings : parseFloat(vendor.total_earnings || '0');

      const dailyBreakdown =
        period === 'week'
          ? buildDailyBreakdownLast7Days([
              ...earnings,
              ...settlementRows.map((ds: any) => ({
                realized_at: ds.order_delivered_at || ds.created_at,
                amount: ds.net_payout,
              })),
            ])
          : undefined;

      return c.json({
        success: true,
        canonicalVendorId: vendorId,
        ledgerVendorIds: vendorIdsForEarnings,
        earningsBackfilled,
        dailyBreakdown,
        dailyEarnings: dailyBreakdown,
        earnings: {
          ...summary,
          transactions,
          dailyBreakdown,
          dailyEarnings: dailyBreakdown,
          totalBookings,
          completedBookings,
          averageBookingValue: Math.round(averageBookingValue * 100) / 100,
          bankVerified: vendor.bank_verified || false,
          razorpayAccountId: vendor.razorpay_account_id || null,
          pendingPayout: parseFloat(vendor.pending_payout || '0'),
          totalEarningsLifetime,
          pendingTierDeduction,
          tierDeductions: deductionRows.map((d: any) => ({
            tierName: d.tier_name,
            totalAmount: parseFloat(d.total_amount),
            amountRemaining: parseFloat(d.amount_remaining),
            installmentsRemaining: d.recovery_installments - d.installments_completed,
          })),
        },
        period,
      });
    } catch (error: any) {
      console.error('Error fetching vendor earnings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/transactions
   * Get vendor transaction history (bookings with earnings)
   * ✅ NEW: Dedicated transactions endpoint for frontend
   */
  app.get("/vendor/:vendorId/transactions", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      // Handle test IDs
      if (paramVendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramVendorId)) {
        return c.json({
          success: true,
          transactions: [],
          total: 0,
        });
      }

      const vendorId = await resolveVendorId(paramVendorId);
      let vendorIdsForTx = await expandVendorIdsForEarningsContext(paramVendorId);
      if (vendorIdsForTx.length === 0) vendorIdsForTx = [vendorId];
      console.log(
        `💳 [TRANSACTIONS] Fetching transactions for vendor: ${paramVendorId} (resolved: ${vendorId}, idCount: ${vendorIdsForTx.length}), period: ${period}, limit: ${limit}`
      );

      await backfillMissingVendorEarningsForVendorIds(vendorIdsForTx, '[TRANSACTIONS-EARNINGS-BACKFILL]', 500);
      await backfillMissingMealDeliverySettlementsForVendorIds(
        vendorIdsForTx,
        '[TRANSACTIONS-MEAL-SETTLEMENT-BACKFILL]',
      );

      const txPeriodScoped = period !== 'lifetime';
      const veTxPeriodSql = txPeriodScoped
        ? ` AND ${sqlTimestampInEarningsPeriod(period, 've.realized_at')}`
        : '';

      // Prefer vendor_earnings (source of truth for earnings) when available
      const hasVendorEarnings = await query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_earnings') as ex`
      ).then((r) => r.rows[0]?.ex).catch(() => false);

      let transactions: any[] = [];
      if (hasVendorEarnings) {
        const txSupCtx = getTemporaryVendorSuppressionParams();
        let veSqlBuilt = `
          SELECT 
            ve.id,
            ve.realized_at as created_at,
            b.booking_date as date,
            COALESCE(sc.display_name, sc.service_name, s.name, vs.service_name, 'Service') as service_name,
            c.full_name as customer_name,
            ve.amount,
            ve.status,
            'booking' as type
          FROM vendor_earnings ve
          LEFT JOIN bookings b ON ve.booking_id = b.id
          LEFT JOIN service_catalog sc ON b.service_id = sc.id
          LEFT JOIN services s ON b.service_id = s.id
          LEFT JOIN vendor_services vs ON b.service_id = vs.id
          LEFT JOIN customers c ON b.customer_id = c.id
          WHERE ve.vendor_id = ANY($1::uuid[])`;
        const veParamsDyn: unknown[] = [vendorIdsForTx];
        let veP = 2;
        if (txPeriodScoped) {
          veSqlBuilt += veTxPeriodSql;
        }
        if (txSupCtx) {
          veSqlBuilt += `\n AND ${sqlExcludeSuppressedVendorEarningsRows('ve', veP, veP + 1)}`;
          veParamsDyn.push(txSupCtx.vendorIds, txSupCtx.cutoffDateIst);
          veP += 2;
        }
        veSqlBuilt += `\n ORDER BY ve.realized_at DESC\n LIMIT $${veP}`;
        veParamsDyn.push(limit);

        const veResult = await query(veSqlBuilt, veParamsDyn).catch(() => ({ rows: [] }));
        const veRows = veResult.rows || [];
        transactions = veRows.map((t: any) => {
          const svcName = t.service_name || t.service || 'Service';
          return {
            id: t.id,
            date: t.date || t.created_at,
            createdAt: t.created_at,
            created_at: t.created_at,
            serviceName: svcName,
            service: svcName,
            customerName: t.customer_name || 'Customer',
            customer: t.customer_name || 'Customer',
            amount: parseFloat(t.amount || '0'),
            price: parseFloat(t.amount || '0'),
            status: t.status || 'completed',
            type: t.type || 'booking',
            description: `Booking - ${svcName}`,
          };
        });
      }

      // Meal/pharmacy hyperlocal delivery settlements (vendor_earnings only covers bookings)
      const dsTxPeriodSql = txPeriodScoped
        ? ` AND ${sqlTimestampInEarningsPeriod(period, 'COALESCE(ds.order_delivered_at, ds.created_at)')}`
        : '';
      const dsSql = `SELECT ds.id, ds.meal_order_id, ds.pharmacy_order_id, ds.net_payout, ds.status,
                    ds.order_delivered_at, ds.created_at, mo.order_number, c.full_name AS customer_name
             FROM delivery_settlements ds
             LEFT JOIN meal_orders mo ON ds.meal_order_id = mo.id
             LEFT JOIN customers c ON mo.customer_id = c.id
             WHERE ds.vendor_id = ANY($1::uuid[])${dsTxPeriodSql}
             ORDER BY COALESCE(ds.order_delivered_at, ds.created_at) DESC`;

      const dsResult = await query(dsSql, [vendorIdsForTx]).catch(() => ({ rows: [] }));

      const deliveryTx = (dsResult.rows || []).map((ds: any) => {
        const credited = ds.order_delivered_at || ds.created_at;
        const svcName = ds.meal_order_id
          ? `Meal delivery${ds.order_number ? ` · ${ds.order_number}` : ''}`
          : ds.pharmacy_order_id
            ? 'Pharmacy delivery'
            : 'Delivery';
        const ledgerStatus = mapDeliverySettlementLedgerStatus(ds.status);
        return {
          id: ds.id,
          date: credited,
          createdAt: credited,
          created_at: credited,
          realizedAt: credited,
          realized_at: credited,
          serviceName: svcName,
          service: svcName,
          customerName: ds.customer_name || 'Customer',
          customer: ds.customer_name || 'Customer',
          amount: safeMoneyAmount(ds.net_payout),
          price: safeMoneyAmount(ds.net_payout),
          status: ledgerStatus,
          type: ds.meal_order_id ? 'meal_delivery' : 'pharmacy_delivery',
          description: svcName,
        };
      });

      transactions = [...transactions, ...deliveryTx]
        .sort(
          (a: any, b: any) =>
            new Date(b.realizedAt || b.created_at || b.date || 0).getTime() -
            new Date(a.realizedAt || a.created_at || a.date || 0).getTime(),
        )
        .slice(0, limit);

      return c.json({
        success: true,
        transactions,
        data: transactions, // Alternative key for compatibility
        total: transactions.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor transactions:', error);
      return c.json({ 
        success: true, 
        transactions: [], 
        total: 0 
      });
    }
  });

  /**
   * GET /vendor/:vendorId/settlements/:settlementId/breakup
   * Get detailed settlement breakup with explanations
   */
  app.get("/vendor/:vendorId/settlements/:settlementId/breakup", async (c) => {
    try {
      const { vendorId: paramVendorId, settlementId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);

      console.log(`📊 [SETTLEMENT-BREAKUP] Fetching breakup for settlement: ${settlementId}, vendor: ${paramVendorId} (resolved: ${vendorId})`);

      // Get settlement with breakup (use resolved vendor id)
      const settlements = await query(
        `SELECT s.*, b.service_name, b.booking_date, b.booking_time,
                v.tier, v.business_name as vendor_name, vt.tier_name, vt.commission_rate as tier_commission
         FROM settlements s
         LEFT JOIN bookings b ON s.booking_id = b.id
         LEFT JOIN vendors v ON s.vendor_id = v.id
         LEFT JOIN vendor_tiers vt ON v.tier = vt.tier_name
         WHERE s.id = $1 AND s.vendor_id = $2`,
        [settlementId, vendorId]
      ).catch(() => ({ rows: [] }));

      const settlementRows = Array.isArray(settlements) ? settlements : settlements.rows || [];
      
      if (settlementRows.length === 0) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      const settlement = settlementRows[0];

      if (shouldHideSettlementRowFromAdminUi(settlement as Record<string, unknown>)) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      // Parse stored breakup or calculate it
      let breakup = null;
      try {
        breakup = settlement.settlement_breakup 
          ? (typeof settlement.settlement_breakup === 'string' 
              ? JSON.parse(settlement.settlement_breakup) 
              : settlement.settlement_breakup)
          : null;
      } catch (e) {
        console.error('Error parsing settlement breakup:', e);
      }

      // If no stored breakup, calculate it
      if (!breakup) {
        const grossAmount = parseFloat(settlement.total_amount || '0');
        const commissionAmount = parseFloat(settlement.commission_amount || '0');
        const tierDeductionAmount = parseFloat(settlement.tier_deduction_amount || '0');
        const vendorAmount = parseFloat(settlement.vendor_amount || '0');
        const commissionRate = parseFloat(settlement.tier_commission || settlement.commission_rate || '10');
        const tierName = settlement.tier || settlement.tier_name || 'Bronze';

        breakup = {
          booking: {
            label: 'Booking Amount',
            amount: grossAmount,
            explanation: 'Total amount charged to customer for this service',
          },
          commission: {
            label: `Platform Commission (${commissionRate}%)`,
            amount: commissionAmount,
            explanation: `Platform fee based on your ${tierName} tier. Lower tiers have higher commission.`,
            how: `₹${grossAmount} × ${commissionRate}% = ₹${commissionAmount.toFixed(2)}`,
          },
          tierDeduction: tierDeductionAmount > 0 ? {
            label: 'Tier Upgrade Recovery',
            amount: tierDeductionAmount,
            explanation: 'Amount deducted for tier upgrade cost recovery',
          } : null,
          netPayout: {
            label: 'Net Amount to Bank',
            amount: vendorAmount,
            explanation: 'Amount credited to your verified bank account',
            how: tierDeductionAmount > 0
              ? `₹${grossAmount} - ₹${commissionAmount} - ₹${tierDeductionAmount} = ₹${vendorAmount.toFixed(2)}`
              : `₹${grossAmount} - ₹${commissionAmount} = ₹${vendorAmount.toFixed(2)}`,
          },
          summary: {
            tierName,
            commissionRate,
            tierBenefit: `Your ${tierName} tier gives you ${commissionRate}% commission rate`,
          },
        };
      }

      return c.json({
        success: true,
        settlement: {
          id: settlement.id,
          bookingId: settlement.booking_id,
          serviceName: settlement.service_name || 'Service',
          bookingDate: settlement.booking_date,
          bookingTime: settlement.booking_time,
          status: settlement.status,
          razorpayTransferId: settlement.razorpay_transfer_id,
          createdAt: settlement.created_at,
          completedAt: settlement.completed_at,
        },
        breakup,
        // ✅ Human-readable explanation
        explanation: {
          title: 'How Your Settlement Was Calculated',
          steps: [
            {
              step: 1,
              title: 'Booking Amount',
              description: `Customer paid ₹${breakup.booking.amount} for this service`,
            },
            {
              step: 2,
              title: 'Platform Commission',
              description: `As a ${breakup.summary.tierName} tier vendor, you pay ${breakup.summary.commissionRate}% commission (₹${breakup.commission.amount.toFixed(2)})`,
              tip: breakup.summary.tierName !== 'Platinum' 
                ? 'Tip: Upgrade to a higher tier to reduce your commission rate!' 
                : 'You have the lowest commission rate!',
            },
            ...(breakup.tierDeduction ? [{
              step: 3,
              title: 'Tier Upgrade Deduction',
              description: `₹${breakup.tierDeduction.amount.toFixed(2)} deducted for tier upgrade cost recovery`,
              note: breakup.tierDeduction.remaining 
                ? `Remaining: ₹${breakup.tierDeduction.remaining.toFixed(2)}` 
                : 'Tier upgrade fully paid!',
            }] : []),
            {
              step: breakup.tierDeduction ? 4 : 3,
              title: 'Your Earnings',
              description: `₹${breakup.netPayout.amount.toFixed(2)} credited to your bank account`,
            },
          ],
        },
      });
    } catch (error: any) {
      console.error('Error fetching settlement breakup:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/settlements/:settlementId/statement
   * Download a JSON statement for a completed settlement (used by the "Statement" button in VendorEarningsSettlementDashboard).
   * Also handles the legacy path /vendor/settlements/:settlementId/statement (vendorId = 'settlements' in that call).
   */
  app.get("/vendor/:vendorId/settlements/:settlementId/statement", async (c) => {
    try {
      const { vendorId: paramVendorId, settlementId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);

      const settlements = await query(
        `SELECT s.*, v.business_name as vendor_name, v.gstin,
                vt.tier_name, vt.commission_rate as tier_commission
         FROM settlements s
         LEFT JOIN vendors v ON s.vendor_id = v.id
         LEFT JOIN vendor_tiers vt ON v.tier = vt.tier_name
         WHERE s.id = $1 AND (s.vendor_id = $2 OR $2 IS NULL)`,
        [settlementId, vendorId || null]
      ).catch(() => ({ rows: [] }));

      const rows = Array.isArray(settlements) ? settlements : settlements.rows || [];
      if (rows.length === 0) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      const s = rows[0];
      const grossAmount = parseFloat(s.total_amount || '0');
      const commissionAmount = parseFloat(s.commission_amount || '0');
      const tierDeductionAmount = parseFloat(s.tier_deduction_amount || '0');
      const vendorAmount = parseFloat(s.vendor_amount || '0');
      const commissionRate = parseFloat(s.tier_commission || s.commission_rate || '10');

      return c.json({
        success: true,
        statement: {
          settlementId: s.id,
          vendorName: s.vendor_name || 'Vendor',
          gstin: s.gstin || null,
          period: {
            from: s.period_start || s.created_at,
            to: s.period_end || s.completed_at,
          },
          status: s.status,
          createdAt: s.created_at,
          completedAt: s.completed_at,
          razorpayTransferId: s.razorpay_transfer_id || null,
          lineItems: [
            { label: 'Gross Amount', amount: grossAmount },
            { label: `Platform Commission (${commissionRate}%)`, amount: -commissionAmount },
            ...(tierDeductionAmount > 0
              ? [{ label: 'Tier Upgrade Recovery', amount: -tierDeductionAmount }]
              : []),
            { label: 'Net Payout', amount: vendorAmount },
          ],
          totals: {
            grossAmount,
            commissionAmount,
            tierDeductionAmount,
            netPayout: vendorAmount,
            commissionRate,
          },
        },
      });
    } catch (error: any) {
      console.error('[SETTLEMENT-STATEMENT] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/settlements
   * Get all settlements for a vendor with breakup summaries
   */
  app.get("/vendor/:vendorId/settlements", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      // Handle test IDs
      if (paramVendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramVendorId)) {
        return c.json({
          success: true,
          settlements: [],
          total: 0,
          summary: {
            pending: 0,
            completed: 0,
            totalSettled: 0,
            pendingAmount: 0,
            availableForPayout: 0,
            heldInOpenPayouts: 0,
          },
        });
      }

      const vendorId = await resolveVendorId(paramVendorId);
      // Bookings/settlements may still reference the identity UUID while the app sends vendors.id (or vice versa).
      const vendorIdSet = new Set<string>([vendorId, paramVendorId.trim()].filter(Boolean));
      const expandedCenter = await expandVendorIdsForEarningsContext(paramVendorId);
      for (const x of expandedCenter) vendorIdSet.add(x);
      const vendorIds = [...vendorIdSet];

      await backfillMissingMealDeliverySettlementsForVendorIds(
        vendorIds,
        '[VENDOR-SETTLEMENTS-MEAL-BACKFILL]',
      );

      const vendorIdArraySql = `ANY($1::uuid[])`;
      let whereClause = `s.vendor_id = ${vendorIdArraySql}`;
      const params: unknown[] = [vendorIds];

      if (status && status !== 'all') {
        whereClause += ` AND s.status = $${params.length + 1}`;
        params.push(status);
      }

      const vendSetSup = getTemporaryVendorSuppressionParams();
      if (vendSetSup) {
        const nx = params.length + 1;
        whereClause += ` AND ${sqlExcludeSuppressedSettlementRows('s', nx, nx + 1)}`;
        params.push(vendSetSup.vendorIds, vendSetSup.cutoffDateIst);
      }

      const settlementsResult = await query(
        `SELECT s.*, b.service_name, b.booking_date
         FROM settlements s
         LEFT JOIN bookings b ON s.booking_id = b.id
         WHERE ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ).catch(() => ({ rows: [] }));

      const settlements = Array.isArray(settlementsResult) ? settlementsResult : settlementsResult.rows || [];

      // Get summary - align with admin: pending_amount, completed_amount, processing_amount
      // Include vendor_earnings pending so "Available for payout" matches request validation
      const sumSetExtra = vendSetSup
        ? ` AND ${sqlExcludeSuppressedSettlementRows('settlements', 2, 3)}`
        : '';
      const earnPendExtra = vendSetSup
        ? ` AND ${sqlExcludeSuppressedVendorEarningsRows('ve', 2, 3)}`
        : '';
      const summaryAggParams = vendSetSup
        ? [vendorIds, vendSetSup.vendorIds, vendSetSup.cutoffDateIst]
        : [vendorIds];
      const earningsPendingParams = vendSetSup
        ? [vendorIds, vendSetSup.vendorIds, vendSetSup.cutoffDateIst]
        : [vendorIds];

      const [summaryResult, earningsPendingResult, payoutsResult, deliveryPendingAmount, deliveryPaidOutAmount] =
        await Promise.all([
        query(
          `SELECT 
             COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
             COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
             COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
             COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'pending' OR settlement_status = 'pending'), 0) as pending_amount,
             COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'processing'), 0) as processing_amount,
             COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'completed'), 0) as completed_amount,
             COALESCE(SUM(tier_deduction_amount), 0) as total_tier_deductions
           FROM settlements
           WHERE vendor_id = ${vendorIdArraySql}${sumSetExtra}`,
          summaryAggParams
        ).catch(() => ({ rows: [{}] })),
        query(
          `SELECT COALESCE(SUM(ve.amount), 0) as pending FROM vendor_earnings ve WHERE ve.vendor_id = ${vendorIdArraySql} AND ve.status = 'pending'${earnPendExtra}`,
          earningsPendingParams
        ).catch(() => ({ rows: [{ pending: '0' }] })),
        query(
          `SELECT *
           FROM payouts po
           WHERE po.vendor_id = ${vendorIdArraySql}
           ${vendSetSup ? ` AND (${sqlExcludeSuppressedVendorCreatedRows('po', 2, 3)})` : ''}
           ORDER BY po.created_at DESC
           LIMIT 30`,
          vendSetSup ? summaryAggParams : [vendorIds]
        ).catch(() => ({ rows: [] })),
        sumPendingDeliverySettlementNetPayout(vendorIds),
        sumTransferredDeliverySettlementNetPayout(vendorIds),
      ]);

      const summary = Array.isArray(summaryResult) ? summaryResult[0] : (summaryResult.rows || [{}])[0];
      const earningsPending = safeMoneyAmount(earningsPendingResult.rows?.[0]?.pending);
      const settlementsPending = safeMoneyAmount(summary.pending_amount);
      const totalPendingAmount =
        settlementsPending + earningsPending + safeMoneyAmount(deliveryPendingAmount);

      const payoutRows = Array.isArray(payoutsResult) ? payoutsResult : payoutsResult.rows || [];
      /** Same net as POST /settlements/request — money already in a queued/processing payout is not requestable again */
      let heldInOpenPayouts = 0;
      for (const pr of payoutRows) {
        const st = String(pr.payout_status || pr.status || '').toLowerCase().trim();
        if (st === 'pending' || st === 'scheduled' || st === 'processing') {
          heldInOpenPayouts += safeMoneyAmount(pr.amount);
        }
      }
      const availableForPayout = Math.max(0, Math.round((totalPendingAmount - heldInOpenPayouts) * 100) / 100);
      const totalPaidOut =
        safeMoneyAmount(summary.completed_amount) + safeMoneyAmount(deliveryPaidOutAmount);

      const payouts = payoutRows.map((p: any) => ({
        id: p.id,
        amount: safeMoneyAmount(p.amount),
        status: String(p.payout_status || p.status || '').trim() || 'unknown',
        razorpayPayoutId: p.razorpay_payout_id || null,
        settlementId: p.settlement_id || null,
        failureReason: p.failure_reason || null,
        createdAt: p.created_at,
        processedAt: p.processed_at,
      }));

      return c.json({
        success: true,
        payouts,
        settlements: settlements.map((s: any) => {
          let breakup = null;
          try {
            breakup = s.settlement_breakup 
              ? (typeof s.settlement_breakup === 'string' ? JSON.parse(s.settlement_breakup) : s.settlement_breakup)
              : null;
          } catch (e) {}

          const grossAmount = parseFloat(s.total_amount ?? s.gross_amount ?? '0');
          const netAmount = parseFloat(s.vendor_amount ?? s.net_amount ?? '0');
          const commissionAmt = parseFloat(s.commission_amount || '0');
          const cr = parseFloat(String(s.commission_rate ?? '').trim() || 'NaN');
          return {
            id: s.id,
            bookingId: s.booking_id,
            serviceName: s.service_name || 'Service',
            bookingDate: s.booking_date,
            grossAmount,
            commissionAmount: commissionAmt,
            commission_amount: commissionAmt,
            commissionRate: Number.isFinite(cr) && cr > 0 ? cr : undefined,
            tierDeduction: parseFloat(s.tier_deduction_amount || '0'),
            netAmount,
            amount: netAmount,
            bookingCount: s.booking_id ? 1 : 0,
            status: s.status,
            razorpayTransferId: s.razorpay_transfer_id,
            payout_reference: s.razorpay_transfer_id || s.utr || null,
            createdAt: s.created_at,
            completedAt: s.completed_at,
            hasBreakup: !!breakup,
          };
        }),
        total: settlements.length,
        summary: {
          pending: parseInt(summary.pending_count || '0', 10),
          processing: parseInt(summary.processing_count || '0', 10),
          completed: parseInt(summary.completed_count || '0', 10),
          totalSettled: totalPaidOut,
          /** Gross: pending settlements + pending vendor_earnings + pending meal/pharmacy delivery (ignores in-flight payout rows) */
          pendingAmount: totalPendingAmount,
          /** Net amount vendor can request now — matches POST /settlements/request validation */
          availableForPayout,
          /** Minimum net available (INR) before POST /settlements/request is allowed */
          minPayoutRequestAmount: MIN_VENDOR_PAYOUT_REQUEST_AMOUNT_INR,
          heldInOpenPayouts: Math.round(heldInOpenPayouts * 100) / 100,
          processingAmount: safeMoneyAmount(summary.processing_amount),
          completedAmount: totalPaidOut,
          paidOut: totalPaidOut,
          totalPaidOut,
          deliveryPendingAmount: safeMoneyAmount(deliveryPendingAmount),
          totalTierDeductions: safeMoneyAmount(summary.total_tier_deductions),
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor settlements:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
