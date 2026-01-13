/**
 * ============================================================================
 * ANALYTICS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles analytics and reporting:
 * - Vendor dashboard analytics
 * - Customer dashboard analytics
 * - Platform analytics (admin)
 * - Revenue analytics
 * - Performance metrics
 * 
 * Migrated from: supabase/functions/server/analytics-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';

export function registerAnalyticsEndpoints(app: Hono) {
  /**
   * GET /analytics/vendor/:vendorId/dashboard
   * Get vendor dashboard statistics
   */
  app.get("/analytics/vendor/:vendorId/dashboard", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'all'; // all, today, week, month, year

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Build date filter
      let dateFilter = '';
      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (period === 'today') {
        dateFilter = `AND DATE(b.booking_date) = CURRENT_DATE`;
      } else if (period === 'week') {
        dateFilter = `AND b.booking_date >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (period === 'month') {
        dateFilter = `AND b.booking_date >= DATE_TRUNC('month', CURRENT_DATE)`;
      } else if (period === 'year') {
        dateFilter = `AND b.booking_date >= DATE_TRUNC('year', CURRENT_DATE)`;
      }

      // Get booking statistics
      const bookingStats = await query(
        `SELECT 
           COUNT(*) as total_bookings,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
           COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
           COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
           COUNT(*) FILTER (WHERE DATE(booking_date) = CURRENT_DATE) as today_bookings,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed' AND booking_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as this_month_revenue
         FROM bookings
         WHERE vendor_id = $1 ${dateFilter}`,
        params
      );

      const stats = bookingStats.rows[0];

      // Get reviews
      const reviewStats = await query(
        `SELECT 
           COUNT(*) as total_reviews,
           COALESCE(AVG(rating), 0) as avg_rating
         FROM reviews
         WHERE vendor_id = $1 AND is_approved = true`,
        [vendorId]
      );

      const reviews = reviewStats.rows[0];

      // Calculate rates
      const totalBookings = parseInt(stats?.total_bookings || '0', 10);
      const completedBookings = parseInt(stats?.completed_bookings || '0', 10);
      const confirmedBookings = parseInt(stats?.confirmed_bookings || '0', 10);
      const cancelledBookings = parseInt(stats?.cancelled_bookings || '0', 10);

      const responseRate = totalBookings > 0
        ? ((confirmedBookings + completedBookings) / totalBookings * 100).toFixed(1)
        : '0';
      const completionRate = totalBookings > 0
        ? (completedBookings / totalBookings * 100).toFixed(1)
        : '0';
      const cancellationRate = totalBookings > 0
        ? (cancelledBookings / totalBookings * 100).toFixed(1)
        : '0';

      return c.json({
        success: true,
        stats: {
          overview: {
            totalBookings,
            pendingBookings: parseInt(stats?.pending_bookings || '0', 10),
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            todayBookings: parseInt(stats?.today_bookings || '0', 10),
            rating: parseFloat(reviews?.avg_rating || '0'),
            totalReviews: parseInt(reviews?.total_reviews || '0', 10),
            responseRate: parseFloat(responseRate),
          },
          revenue: {
            total: parseFloat(stats?.total_revenue || '0'),
            thisMonth: parseFloat(stats?.this_month_revenue || '0'),
            average: completedBookings > 0
              ? parseFloat(stats?.total_revenue || '0') / completedBookings
              : 0,
          },
          performance: {
            completionRate: parseFloat(completionRate),
            cancellationRate: parseFloat(cancellationRate),
          },
        },
      });
    } catch (error: any) {
      console.error('Error getting vendor analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /analytics/customer/:customerId/dashboard
   * Get customer dashboard statistics
   */
  app.get("/analytics/customer/:customerId/dashboard", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get pets count
      const pets = await select('pets', { customer_id: customerId });
      const totalPets = pets.length;

      // Get booking statistics
      const bookingStats = await query(
        `SELECT 
           COUNT(*) as total_bookings,
           COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed', 'in_progress')) as upcoming_bookings,
           COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_spent
         FROM bookings
         WHERE customer_id = $1`,
        [customerId]
      );

      const stats = bookingStats.rows[0];

      // Get reviews count
      const reviews = await query(
        'SELECT COUNT(*) as total_reviews FROM reviews WHERE customer_id = $1',
        [customerId]
      );

      // Get orders count
      const orders = await query(
        'SELECT COUNT(*) as total_orders FROM orders WHERE customer_id = $1',
        [customerId]
      );

      // Get wallet balance
      const wallets = await select('customer_wallets', { customer_id: customerId });
      const walletBalance = wallets.length > 0 ? wallets[0].balance : 0;

      return c.json({
        success: true,
        stats: {
          pets: {
            total: totalPets,
          },
          bookings: {
            total: parseInt(stats?.total_bookings || '0', 10),
            upcoming: parseInt(stats?.upcoming_bookings || '0', 10),
            completed: parseInt(stats?.completed_bookings || '0', 10),
          },
          spending: {
            total: parseFloat(stats?.total_spent || '0'),
            average: parseInt(stats?.completed_bookings || '0', 10) > 0
              ? parseFloat(stats?.total_spent || '0') / parseInt(stats?.completed_bookings || '0', 10)
              : 0,
          },
          reviews: {
            total: parseInt(reviews.rows[0]?.total_reviews || '0', 10),
          },
          orders: {
            total: parseInt(orders.rows[0]?.total_orders || '0', 10),
          },
          wallet: {
            balance: parseFloat(walletBalance || '0'),
          },
        },
      });
    } catch (error: any) {
      console.error('Error getting customer analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /analytics/platform/overview
   * Get platform-wide analytics (admin only)
   */
  app.get("/analytics/platform/overview", async (c) => {
    try {
      // Get vendor statistics
      const vendorStats = await query(
        `SELECT 
           COUNT(*) as total_vendors,
           COUNT(*) FILTER (WHERE status = 'approved' AND is_active = true) as active_vendors,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_vendors
         FROM vendors`
      );

      // Get customer statistics
      const customerStats = await query(
        `SELECT COUNT(*) as total_customers FROM customers`
      );

      // Get booking statistics
      const bookingStats = await query(
        `SELECT 
           COUNT(*) as total_bookings,
           COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed' AND booking_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as this_month_revenue
         FROM bookings`
      );

      // Get order statistics
      const orderStats = await query(
        `SELECT 
           COUNT(*) as total_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'delivered'), 0) as total_revenue
         FROM orders`
      );

      return c.json({
        success: true,
        stats: {
          vendors: {
            total: parseInt(vendorStats.rows[0]?.total_vendors || '0', 10),
            active: parseInt(vendorStats.rows[0]?.active_vendors || '0', 10),
            pending: parseInt(vendorStats.rows[0]?.pending_vendors || '0', 10),
          },
          customers: {
            total: parseInt(customerStats.rows[0]?.total_customers || '0', 10),
          },
          bookings: {
            total: parseInt(bookingStats.rows[0]?.total_bookings || '0', 10),
            completed: parseInt(bookingStats.rows[0]?.completed_bookings || '0', 10),
          },
          revenue: {
            total: parseFloat(bookingStats.rows[0]?.total_revenue || '0') + parseFloat(orderStats.rows[0]?.total_revenue || '0'),
            thisMonth: parseFloat(bookingStats.rows[0]?.this_month_revenue || '0'),
            fromBookings: parseFloat(bookingStats.rows[0]?.total_revenue || '0'),
            fromOrders: parseFloat(orderStats.rows[0]?.total_revenue || '0'),
          },
          orders: {
            total: parseInt(orderStats.rows[0]?.total_orders || '0', 10),
          },
        },
      });
    } catch (error: any) {
      console.error('Error getting platform analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /analytics/vendor/:vendorId/revenue
   * Get vendor revenue analytics
   */
  app.get("/analytics/vendor/:vendorId/revenue", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');

      let revenueQuery = `
        SELECT 
           DATE(booking_date) as date,
           COUNT(*) as booking_count,
           SUM(total_amount) as revenue
         FROM bookings
         WHERE vendor_id = $1
         AND status = 'completed'
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (startDate) {
        revenueQuery += ` AND booking_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        revenueQuery += ` AND booking_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      revenueQuery += ` GROUP BY DATE(booking_date) ORDER BY date DESC LIMIT 30`;

      const revenue = await query(revenueQuery, params);

      return c.json({
        success: true,
        revenue: revenue.rows,
        total: revenue.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting vendor revenue analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // ADMIN ANALYTICS ENDPOINTS (Admin UI compatibility)
  // ============================================

  /**
   * GET /admin/analytics/overview
   * Admin analytics overview (alias for /analytics/platform/overview)
   */
  app.get("/admin/analytics/overview", async (c) => {
    try {
      // Reuse platform overview logic
      const vendorStats = await query(
        `SELECT 
           COUNT(*) as total_vendors,
           COUNT(*) FILTER (WHERE status = 'approved' AND is_active = true) as active_vendors,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_vendors
         FROM vendors`
      );

      const customerStats = await query(
        `SELECT COUNT(*) as total_customers FROM customers`
      );

      const bookingStats = await query(
        `SELECT 
           COUNT(*) as total_bookings,
           COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed' AND booking_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as this_month_revenue
         FROM bookings`
      );

      const orderStats = await query(
        `SELECT 
           COUNT(*) as total_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'delivered'), 0) as total_revenue
         FROM orders`
      );

      return c.json({
        success: true,
        stats: {
          vendors: {
            total: parseInt(vendorStats.rows[0]?.total_vendors || '0', 10),
            active: parseInt(vendorStats.rows[0]?.active_vendors || '0', 10),
            pending: parseInt(vendorStats.rows[0]?.pending_vendors || '0', 10),
          },
          customers: {
            total: parseInt(customerStats.rows[0]?.total_customers || '0', 10),
          },
          bookings: {
            total: parseInt(bookingStats.rows[0]?.total_bookings || '0', 10),
            completed: parseInt(bookingStats.rows[0]?.completed_bookings || '0', 10),
          },
          revenue: {
            total: parseFloat(bookingStats.rows[0]?.total_revenue || '0') + parseFloat(orderStats.rows[0]?.total_revenue || '0'),
            thisMonth: parseFloat(bookingStats.rows[0]?.this_month_revenue || '0'),
            fromBookings: parseFloat(bookingStats.rows[0]?.total_revenue || '0'),
            fromOrders: parseFloat(orderStats.rows[0]?.total_revenue || '0'),
          },
          orders: {
            total: parseInt(orderStats.rows[0]?.total_orders || '0', 10),
          },
        },
      });
    } catch (error: any) {
      console.error('Error getting admin analytics overview:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/vendors
   * Get vendor analytics for admin
   */
  app.get("/admin/analytics/vendors", async (c) => {
    try {
      const period = c.req.query('period') || '30';
      const days = parseInt(period, 10);

      const vendorStats = await query(
        `SELECT 
           v.id,
           v.business_name,
           v.city,
           COUNT(b.id) as total_bookings,
           COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as revenue,
           COALESCE(AVG(r.rating), 0) as avg_rating
         FROM vendors v
         LEFT JOIN bookings b ON v.id = b.vendor_id AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
         LEFT JOIN reviews r ON v.id = r.vendor_id
         WHERE v.status = 'approved' AND v.is_active = true
         GROUP BY v.id, v.business_name, v.city
         ORDER BY revenue DESC
         LIMIT 50`
      );

      return c.json({
        success: true,
        vendors: vendorStats.rows,
        total: vendorStats.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting vendor analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/customers
   * Get customer analytics for admin
   */
  app.get("/admin/analytics/customers", async (c) => {
    try {
      const period = c.req.query('period') || '30';
      const days = parseInt(period, 10);

      const customerStats = await query(
        `SELECT 
           c.id,
           c.full_name as name,
           c.phone,
           c.city,
           COUNT(b.id) as total_bookings,
           COUNT(o.id) as total_orders,
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as booking_spend,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as order_spend
         FROM customers c
         LEFT JOIN bookings b ON c.id = b.customer_id AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
         LEFT JOIN orders o ON c.id = o.customer_id AND o.created_at >= CURRENT_DATE - INTERVAL '${days} days'
         GROUP BY c.id, c.full_name, c.phone, c.city
         ORDER BY (COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) + COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0)) DESC
         LIMIT 50`
      );

      return c.json({
        success: true,
        customers: customerStats.rows,
        total: customerStats.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting customer analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

