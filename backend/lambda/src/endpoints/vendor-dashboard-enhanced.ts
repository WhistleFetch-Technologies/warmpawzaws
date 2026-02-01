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
 * Migrated from: supabase/functions/make-server-3dd53475/vendor-dashboard-endpoints-refactored.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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

      console.log(`📊 [DASHBOARD] Fetching dashboard for vendor: ${vendorId}, timeframe: ${timeframe}`);

      // Get vendor (post-role-migration: vendor may be in vendor_identity only; still show bookings)
      const vendors = await select('vendors', { id: vendorId });
      const vendor = vendors.length > 0 ? vendors[0] : null;

      // Calculate date range
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

      // Get bookings for vendor with enrichment (always query by vendorId so placeholder shows post-migration)
      const bookings = await query(
        `SELECT b.*,
                COALESCE(s.name, vs.service_name) as service_name,
                COALESCE(s.category, vs.category) as service_category,
                c.full_name as customer_name,
                c.phone as customer_phone
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN vendor_services vs ON vs.id = b.service_id
         LEFT JOIN customers c ON b.customer_id = c.id
         WHERE b.vendor_id = $1 
           AND b.booking_date >= $2
           AND b.status != 'cancelled'
         ORDER BY b.booking_date ASC, b.booking_time ASC`,
        [vendorId, startDate.toISOString().split('T')[0]]
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
   * Alternative route pattern for frontend compatibility
   */
  app.get("/vendor/:vendorId/dashboard", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'today';

      // Handle test IDs - return empty dashboard
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
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

      console.log(`📊 [DASHBOARD] Fetching dashboard for vendor: ${vendorId}, timeframe: ${timeframe}`);

      // Get vendor (post-role-migration: still return bookings so dashboard shows placeholders)
      const vendors = await select('vendors', { id: vendorId });
      const vendor = vendors.length > 0 ? vendors[0] : null;

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Get bookings stats (include pending in today_bookings so new appointments show)
      const bookingsStats = await query(
        `SELECT 
          COUNT(*) FILTER (WHERE booking_date = $1 AND status IN ('pending', 'confirmed')) as today_bookings,
          COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')) as pending_bookings,
          COUNT(*) FILTER (WHERE booking_date = $1 AND status = 'completed') as completed_today
        FROM bookings 
        WHERE vendor_id = $2`,
        [today, vendorId]
      ).catch(() => ({ rows: [{ today_bookings: '0', pending_bookings: '0', completed_today: '0' }] }));

      // Get earnings stats
      const earningsStats = await query(
        `SELECT 
          COALESCE(SUM(total_amount), 0) as earnings,
          COALESCE(SUM(CASE WHEN status = 'completed' AND settlement_status != 'settled' THEN total_amount ELSE 0 END), 0) as pending_settlement
        FROM bookings 
        WHERE vendor_id = $1 AND status = 'completed'`,
        [vendorId]
      ).catch(() => ({ rows: [{ earnings: '0', pending_settlement: '0' }] }));

      // Get rating
      const ratingStats = await query(
        `SELECT 
          COALESCE(AVG(rating), 4.8) as rating,
          COUNT(*) as total_reviews
        FROM reviews 
        WHERE vendor_id = $1 AND is_approved = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ rating: '4.8', total_reviews: '0' }] }));

      const stats = bookingsStats.rows[0];
      const earnings = earningsStats.rows[0];
      const rating = ratingStats.rows[0];

      // ✅ FIX: Get bookings for display, sorted by date and time (earliest first)
      let startDate = new Date();
      if (timeframe === 'today') {
        startDate = new Date(today);
      } else if (timeframe === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeframe === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const bookingsResult = await query(
        `SELECT b.*,
                COALESCE(s.name, vs.service_name) as service_name,
                COALESCE(s.category, vs.category) as service_category,
                c.full_name as customer_name,
                c.phone as customer_phone
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN vendor_services vs ON vs.id = b.service_id
         LEFT JOIN customers c ON b.customer_id = c.id
         WHERE b.vendor_id = $1 
           AND b.booking_date >= $2
           AND b.status NOT IN ('cancelled')
         ORDER BY b.booking_date ASC, b.booking_time ASC`,
        [vendorId, startDate.toISOString().split('T')[0]]
      ).catch(() => ({ rows: [] }));

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

      console.log(`📊 [DASHBOARD] Returning ${enrichedBookings.length} bookings for vendor ${vendorId}`);

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
   */
  app.get("/vendor/:vendorId/analytics", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year, all

      console.log(`📊 [ANALYTICS] Fetching analytics for vendor: ${vendorId}, period: ${period}`);

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

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

      // Get bookings
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

      return c.json({
        success: true,
        analytics: {
          ...analytics,
          rating: parseFloat(rating.toFixed(1)),
          totalReviews: reviews.rows.length,
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
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year, lifetime

      console.log(`💰 [EARNINGS] Fetching earnings for vendor: ${vendorId}, period: ${period}`);

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
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

      // Get vendor_earnings records
      const earningsQuery = period === 'lifetime'
        ? `SELECT ve.*, b.booking_date, b.service_id, s.name as service_name
           FROM vendor_earnings ve
           LEFT JOIN bookings b ON ve.booking_id = b.id
           LEFT JOIN services s ON b.service_id = s.id
           WHERE ve.vendor_id = $1
           ORDER BY ve.realized_at DESC`
        : `SELECT ve.*, b.booking_date, b.service_id, s.name as service_name
           FROM vendor_earnings ve
           LEFT JOIN bookings b ON ve.booking_id = b.id
           LEFT JOIN services s ON b.service_id = s.id
           WHERE ve.vendor_id = $1
             AND ve.realized_at >= $2
           ORDER BY ve.realized_at DESC`;

      const earningsResult = await query(
        earningsQuery,
        period === 'lifetime' ? [vendorId] : [vendorId, startDate.toISOString()]
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

      return c.json({
        success: true,
        earnings: {
          ...summary,
          transactions,
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
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      console.log(`💳 [TRANSACTIONS] Fetching transactions for vendor: ${vendorId}, period: ${period}, limit: ${limit}`);

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          transactions: [],
          total: 0,
        });
      }

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

      // Get completed bookings with customer info as transactions
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

      // Transform to frontend expected format
      const transactions = rows.map((t: any) => ({
        id: t.id,
        date: t.date || t.created_at,
        createdAt: t.created_at,
        serviceName: t.service_name || t.service || 'Service',
        service: t.service_name || t.service || 'Service',
        customerName: t.customer_name || 'Customer',
        customer: t.customer_name || 'Customer',
        amount: parseFloat(t.amount || '0'),
        price: parseFloat(t.amount || '0'),
        status: t.transaction_status || t.status || 'completed',
        type: t.type || 'booking',
      }));

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
      const { vendorId, settlementId } = c.req.param();

      console.log(`📊 [SETTLEMENT-BREAKUP] Fetching breakup for settlement: ${settlementId}`);

      // Get settlement with breakup
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
      const { vendorId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          settlements: [],
          total: 0,
          summary: { pending: 0, completed: 0, totalSettled: 0 },
        });
      }

      let whereClause = 's.vendor_id = $1';
      const params: any[] = [vendorId];

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

      // Get summary - align with admin: pending_amount, completed_amount, processing_amount (same calculation as admin per vendor)
      const summaryResult = await query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
           COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
           COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
           COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'pending'), 0) as pending_amount,
           COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'processing'), 0) as processing_amount,
           COALESCE(SUM(COALESCE(vendor_amount, net_amount)) FILTER (WHERE status = 'completed'), 0) as completed_amount,
           COALESCE(SUM(tier_deduction_amount), 0) as total_tier_deductions
         FROM settlements
         WHERE vendor_id = $1`,
        [vendorId]
      ).catch(() => ({ rows: [{}] }));

      const summary = Array.isArray(summaryResult) ? summaryResult[0] : (summaryResult.rows || [{}])[0];

      return c.json({
        success: true,
        settlements: settlements.map((s: any) => {
          let breakup = null;
          try {
            breakup = s.settlement_breakup 
              ? (typeof s.settlement_breakup === 'string' ? JSON.parse(s.settlement_breakup) : s.settlement_breakup)
              : null;
          } catch (e) {}

          const grossAmount = parseFloat(s.total_amount ?? s.gross_amount ?? '0');
          const netAmount = parseFloat(s.vendor_amount ?? s.net_amount ?? '0');
          return {
            id: s.id,
            bookingId: s.booking_id,
            serviceName: s.service_name || 'Service',
            bookingDate: s.booking_date,
            grossAmount,
            commissionAmount: parseFloat(s.commission_amount || '0'),
            tierDeduction: parseFloat(s.tier_deduction_amount || '0'),
            netAmount,
            amount: netAmount,
            status: s.status,
            razorpayTransferId: s.razorpay_transfer_id,
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
          pendingAmount: parseFloat(summary.pending_amount || '0'),
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

