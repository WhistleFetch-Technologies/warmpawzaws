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
import { resolveVendorId } from '../../../utils/vendor-resolve';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

/** Last 7 local calendar days with summed vendor_earnings amounts (for vendor earnings chart). */
function buildDailyBreakdownLast7Days(
  earningsRows: Array<{ realized_at?: string | null; amount?: string | number | null }>,
  ref: Date = new Date()
): Array<{ day: string; date: string; amount: number }> {
  const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const formatLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const byKey = new Map<string, number>();
  for (const e of earningsRows) {
    if (!e?.realized_at) continue;
    const k = formatLocalYmd(new Date(e.realized_at));
    const a = parseFloat(String(e.amount ?? '0'));
    if (!Number.isFinite(a)) continue;
    byKey.set(k, (byKey.get(k) || 0) + a);
  }
  const out: Array<{ day: string; date: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i, 12, 0, 0, 0);
    const key = formatLocalYmd(d);
    const raw = byKey.get(key) || 0;
    const amt = Math.round(raw * 100) / 100;
    out.push({ day: shortDay[d.getDay()] ?? '—', date: key, amount: amt });
  }
  return out;
}

const VENDOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vendor ids to include when reading vendor_earnings — matches GET /vendor/bookings/:id center logic
 * so clinic/center earnings stored under sibling vendor rows still appear for the logged-in account.
 */
async function expandVendorIdsForEarningsContext(paramVendorId: string): Promise<string[]> {
  const trimmed = (paramVendorId || '').trim();
  if (!VENDOR_UUID_RE.test(trimmed)) return [];
  const ids = new Set<string>([trimmed]);
  let resolved = trimmed;
  try {
    resolved = await resolveVendorId(trimmed);
    if (VENDOR_UUID_RE.test(resolved)) ids.add(resolved);
  } catch {
    /* keep trimmed only */
  }
  try {
    const cr = await query(
      `SELECT center_id FROM vendors WHERE id = $1::uuid OR id = $2::uuid LIMIT 1`,
      [resolved, trimmed]
    ).catch(() => ({ rows: [] as { center_id?: string }[] }));
    const cid = cr.rows?.[0]?.center_id;
    if (cid) {
      const sib = await query(`SELECT id FROM vendors WHERE center_id = $1::uuid`, [cid]).catch(() => ({
        rows: [] as { id: string }[],
      }));
      for (const row of sib.rows || []) {
        if (row?.id && VENDOR_UUID_RE.test(String(row.id))) ids.add(String(row.id));
      }
    }
  } catch {
    /* ignore */
  }
  return [...ids];
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
            rating: 4.8,
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
      let startDate = new Date();

      if (timeframe === 'today') {
        startDate = new Date(today);
      } else if (timeframe === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const startDateStr = startDate.toISOString().split('T')[0];
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
               AND b.status != 'pending_payment'
               AND b.status != 'cancelled'
             ORDER BY b.booking_date ASC, b.booking_time ASC`,
            [resolvedVendorId, startDateStr]
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
               AND b.status != 'pending_payment'
               AND b.status != 'cancelled'
             ORDER BY b.booking_date ASC, b.booking_time ASC`,
            [vendorIds[0], vendorIds[1], startDateStr]
          ).catch(() => ({ rows: [] }));

      // Calculate stats
      const stats = {
        appointments: 0,
        consultations: 0,
        earnings: 0,
        pendingEarnings: 0,
        completedServices: 0,
        rating: 0,
        totalReviews: 0,
      };

      for (const booking of bookings.rows) {
        if (['confirmed', 'pending'].includes(booking.status)) {
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

      // Get reviews
      const reviews = await query(
        'SELECT * FROM reviews WHERE vendor_id = $1',
        [vendorId]
      ).catch(() => ({ rows: [] }));

      if (reviews.rows.length > 0) {
        const totalRating = reviews.rows.reduce((sum: number, review: any) => sum + (parseFloat(review.rating || '0')), 0);
        stats.rating = parseFloat((totalRating / reviews.rows.length).toFixed(1));
        stats.totalReviews = reviews.rows.length;
      } else {
        stats.rating = 4.8; // Default rating for new vendors
        stats.totalReviews = 0;
      }

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
            rating: 4.8,
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

      // Get bookings stats (include both identity and vendor id so center/clinic bookings count)
      const [statsParam1, statsParam2] = vendorIds.length >= 2 ? [vendorIds[0], vendorIds[1]] : [vendorIds[0], vendorIds[0]];
      const bookingsStatsQuery = vendorIds.length === 1
        ? `SELECT 
          COUNT(*) FILTER (WHERE booking_date = $1 AND status IN ('pending', 'confirmed')) as today_bookings,
          COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')) as pending_bookings,
          COUNT(*) FILTER (WHERE booking_date = $1 AND status = 'completed') as completed_today
        FROM bookings 
        WHERE vendor_id = $2`
        : `SELECT 
          COUNT(*) FILTER (WHERE booking_date = $1 AND status IN ('pending', 'confirmed')) as today_bookings,
          COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')) as pending_bookings,
          COUNT(*) FILTER (WHERE booking_date = $1 AND status = 'completed') as completed_today
        FROM bookings 
        WHERE (vendor_id = $2 OR vendor_id = $3)`;
      const bookingsStatsParams = vendorIds.length === 1 ? [today, statsParam1] : [today, statsParam1, statsParam2];
      const bookingsStats = await query(bookingsStatsQuery, bookingsStatsParams).catch(() => ({ rows: [{ today_bookings: '0', pending_bookings: '0', completed_today: '0' }] }));

      // Prefer vendor_earnings (source of truth) when available; fallback to bookings
      const hasVendorEarnings = await query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_earnings') as ex`
      ).then((r) => r.rows[0]?.ex).catch(() => false);

      let earningsFromTable = { earnings: '0', pending_settlement: '0' };
      if (hasVendorEarnings) {
        let veIds = await expandVendorIdsForEarningsContext(paramVendorId);
        if (veIds.length === 0) veIds = [resolvedVendorId];
        const veRes = await query(
          `SELECT 
             COALESCE(SUM(amount), 0) as earnings,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_settlement
           FROM vendor_earnings
           WHERE vendor_id = ANY($1::uuid[])`,
          [veIds]
        ).catch(() => ({ rows: [{ earnings: '0', pending_settlement: '0' }] }));
        earningsFromTable = veRes.rows[0] || earningsFromTable;
      }

      const earningsQuery = vendorIds.length === 1
        ? `SELECT COALESCE(SUM(total_amount), 0) as earnings, COALESCE(SUM(CASE WHEN status = 'completed' AND (settlement_status IS NULL OR settlement_status != 'settled') THEN total_amount ELSE 0 END), 0) as pending_settlement FROM bookings WHERE vendor_id = $1 AND status = 'completed'`
        : `SELECT COALESCE(SUM(total_amount), 0) as earnings, COALESCE(SUM(CASE WHEN status = 'completed' AND (settlement_status IS NULL OR settlement_status != 'settled') THEN total_amount ELSE 0 END), 0) as pending_settlement FROM bookings WHERE (vendor_id = $1 OR vendor_id = $2) AND status = 'completed'`;
      const earningsStats = await query(earningsQuery, vendorIds).catch(() => ({ rows: [{ earnings: '0', pending_settlement: '0' }] }));
      const earningsFromBookings = earningsStats.rows[0] || { earnings: '0', pending_settlement: '0' };

      // Use vendor_earnings when available for consistency with earnings API and payout flow
      const earnings = hasVendorEarnings
        ? { earnings: earningsFromTable.earnings, pending_settlement: earningsFromTable.pending_settlement }
        : earningsFromBookings;

      const ratingQuery = vendorIds.length === 1
        ? `SELECT COALESCE(AVG(rating), 4.8) as rating, COUNT(*) as total_reviews FROM reviews WHERE vendor_id = $1 AND is_approved = true`
        : `SELECT COALESCE(AVG(rating), 4.8) as rating, COUNT(*) as total_reviews FROM reviews WHERE (vendor_id = $1 OR vendor_id = $2) AND is_approved = true`;
      const ratingStats = await query(ratingQuery, vendorIds).catch(() => ({ rows: [{ rating: '4.8', total_reviews: '0' }] }));

      const stats = bookingsStats.rows[0];
      const rating = ratingStats.rows[0];

      // ✅ FIX: Get bookings for display (vendor_id IN resolved/param), include service_catalog for center/clinic service names
      let startDate = new Date();
      if (timeframe === 'today') {
        startDate = new Date(today);
      } else if (timeframe === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeframe === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const startDateStr = startDate.toISOString().split('T')[0];
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
           AND b.status NOT IN ('cancelled')
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
           AND b.status NOT IN ('cancelled')
         ORDER BY b.booking_date ASC, b.booking_time ASC`;
      const bookingsParams = vendorIds.length === 1 ? [resolvedVendorId, startDateStr] : [vendorIds[0], vendorIds[1], startDateStr];
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
          rating: parseFloat(rating.rating || '4.8'),
          totalReviews: parseInt(rating.total_reviews || '0', 10),
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
      const bookings = await query(
        `SELECT * FROM bookings 
         WHERE vendor_id = $1 
           AND created_at >= $2
         ORDER BY created_at DESC`,
        [vendorId, periodStart.toISOString()]
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
          rating: ratingRounded,
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
        `💰 [EARNINGS] Fetching earnings for vendor: ${paramVendorId} (resolved: ${vendorId}, idCount: ${vendorIdsForEarnings.length}), period: ${period}`
      );

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case 'day':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'lifetime':
          startDate = new Date(0);
          break;
      }

      // Get vendor_earnings records (center-aware: align with GET /vendor/bookings/:id sibling vendors)
      const earningsQuery = period === 'lifetime'
        ? `SELECT ve.*, b.booking_date, b.service_id, s.name as service_name
           FROM vendor_earnings ve
           LEFT JOIN bookings b ON ve.booking_id = b.id
           LEFT JOIN services s ON b.service_id = s.id
           WHERE ve.vendor_id = ANY($1::uuid[])
           ORDER BY ve.realized_at DESC`
        : `SELECT ve.*, b.booking_date, b.service_id, s.name as service_name
           FROM vendor_earnings ve
           LEFT JOIN bookings b ON ve.booking_id = b.id
           LEFT JOIN services s ON b.service_id = s.id
           WHERE ve.vendor_id = ANY($1::uuid[])
             AND ve.realized_at >= $2
           ORDER BY ve.realized_at DESC`;

      const earningsResult = await query(
        earningsQuery,
        period === 'lifetime' ? [vendorIdsForEarnings] : [vendorIdsForEarnings, startDate.toISOString()]
      ).catch(() => ({ rows: [] }));

      const earnings = earningsResult.rows || [];

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
        const amount = parseFloat(e.amount || '0');
        const commission = parseFloat(e.commission_amount || '0');
        const total = parseFloat(e.total_amount || '0');

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

        if (e.realized_at && new Date(e.realized_at) >= startDate) {
          summary.thisPeriod += amount;
        }
      });

      // Get vendor info for bank verification status
      const vendors = await select('vendors', { id: vendorId });
      const vendor = vendors[0] || {};

      // Transform transactions
      const transactions = earnings.map((e: any) => ({
        id: e.id,
        bookingId: e.booking_id,
        bookingDate: e.booking_date,
        serviceName: e.service_name || 'Service',
        amount: parseFloat(e.amount || '0'),
        commission: parseFloat(e.commission_amount || '0'),
        totalAmount: parseFloat(e.total_amount || '0'),
        commissionRate: parseFloat(e.commission_rate || '0'),
        status: e.status,
        realizedAt: e.realized_at,
        paidOutAt: e.paid_out_at,
        settlementId: e.settlement_id,
      }));

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

      const dailyBreakdown = period === 'week' ? buildDailyBreakdownLast7Days(earnings) : undefined;

      return c.json({
        success: true,
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

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case 'day':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'lifetime':
          startDate = new Date(0);
          break;
      }

      // Prefer vendor_earnings (source of truth for earnings) when available
      const hasVendorEarnings = await query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_earnings') as ex`
      ).then((r) => r.rows[0]?.ex).catch(() => false);

      let transactions: any[] = [];
      if (hasVendorEarnings) {
        const veQuery = `
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
          WHERE ve.vendor_id = ANY($1::uuid[])
            ${period !== 'lifetime' ? 'AND ve.realized_at >= $2' : ''}
          ORDER BY ve.realized_at DESC
          LIMIT $${period === 'lifetime' ? '2' : '3'}
        `;
        const veResult = await query(
          veQuery,
          period === 'lifetime'
            ? [vendorIdsForTx, limit]
            : [vendorIdsForTx, startDate.toISOString(), limit]
        ).catch(() => ({ rows: [] }));
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

      if (transactions.length === 0) {
        // Fallback to bookings
        const transactionsQuery = `
          SELECT 
            b.id,
            b.booking_date as date,
            b.completed_at as created_at,
            s.name as service_name,
            COALESCE(s.name, b.service_name, 'Service') as service,
            c.full_name as customer_name,
            c.phone as customer_phone,
            b.total_amount as amount,
            b.status,
            CASE 
              WHEN b.status = 'completed' THEN 'completed'
              WHEN b.status = 'cancelled' THEN 'cancelled'
              ELSE 'pending'
            END as transaction_status,
            'booking' as type
          FROM bookings b
          LEFT JOIN services s ON b.service_id = s.id
          LEFT JOIN customers c ON b.customer_id = c.id
          WHERE b.vendor_id = $1
            AND b.status IN ('completed', 'confirmed', 'pending', 'cancelled')
            ${period !== 'lifetime' ? 'AND b.created_at >= $3' : ''}
          ORDER BY b.created_at DESC
          LIMIT $2
        `;
        const result = await query(
          transactionsQuery,
          period === 'lifetime' ? [vendorId, limit] : [vendorId, limit, startDate.toISOString()]
        ).catch(() => ({ rows: [] }));
        const rows = result.rows || [];
        transactions = rows.map((t: any) => {
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
            status: t.transaction_status || t.status || 'completed',
            type: t.type || 'booking',
            description: `Booking - ${svcName}`,
          };
        });
      }

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
          summary: { pending: 0, completed: 0, totalSettled: 0 },
        });
      }

      const vendorId = await resolveVendorId(paramVendorId);
      // Bookings/settlements may still reference the identity UUID while the app sends vendors.id (or vice versa).
      const vendorIdSet = new Set<string>([vendorId, paramVendorId.trim()].filter(Boolean));
      const expandedCenter = await expandVendorIdsForEarningsContext(paramVendorId);
      for (const x of expandedCenter) vendorIdSet.add(x);
      const vendorIds = [...vendorIdSet];
      const vendorIdArraySql = `ANY($1::uuid[])`;
      let whereClause = `s.vendor_id = ${vendorIdArraySql}`;
      const params: any[] = [vendorIds];

      if (status && status !== 'all') {
        whereClause += ' AND s.status = $2';
        params.push(status);
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
      const [summaryResult, earningsPendingResult, payoutsResult] = await Promise.all([
        query(
          `SELECT 
             COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
             COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
             COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
             COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'pending'), 0) as pending_amount,
             COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'processing'), 0) as processing_amount,
             COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'completed'), 0) as completed_amount,
             COALESCE(SUM(tier_deduction_amount), 0) as total_tier_deductions
           FROM settlements
           WHERE vendor_id = ${vendorIdArraySql}`,
          [vendorIds]
        ).catch(() => ({ rows: [{}] })),
        query(
          `SELECT COALESCE(SUM(amount), 0) as pending FROM vendor_earnings WHERE vendor_id = ${vendorIdArraySql} AND status = 'pending'`,
          [vendorIds]
        ).catch(() => ({ rows: [{ pending: '0' }] })),
        query(
          `SELECT *
           FROM payouts
           WHERE vendor_id = ${vendorIdArraySql}
           ORDER BY created_at DESC
           LIMIT 30`,
          [vendorIds]
        ).catch(() => ({ rows: [] })),
      ]);

      const summary = Array.isArray(summaryResult) ? summaryResult[0] : (summaryResult.rows || [{}])[0];
      const earningsPending = parseFloat(earningsPendingResult.rows?.[0]?.pending || '0');
      const settlementsPending = parseFloat(summary.pending_amount || '0');
      const totalPendingAmount = settlementsPending + earningsPending;

      const payoutRows = Array.isArray(payoutsResult) ? payoutsResult : payoutsResult.rows || [];
      const payouts = payoutRows.map((p: any) => ({
        id: p.id,
        amount: parseFloat(p.amount || '0'),
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
          pending: parseInt(summary.pending_count || '0'),
          processing: parseInt(summary.processing_count || '0'),
          completed: parseInt(summary.completed_count || '0'),
          totalSettled: parseFloat(summary.completed_amount ?? summary.total_settled ?? '0'),
          pendingAmount: totalPendingAmount,
          processingAmount: parseFloat(summary.processing_amount || '0'),
          completedAmount: parseFloat(summary.completed_amount || '0'),
          totalTierDeductions: parseFloat(summary.total_tier_deductions || '0'),
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor settlements:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
