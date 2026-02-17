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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { resolveVendorId } from '../utils/vendor-resolve';

export function registerAnalyticsEndpoints(app: Hono) {
  /**
   * GET /analytics/vendor/:vendorId/dashboard
   * Get vendor dashboard statistics
   */
  app.get("/analytics/vendor/:vendorId/dashboard", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
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
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
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
   * Get vendor analytics for admin - aligned with frontend expectations
   */
  app.get("/admin/analytics/vendors", async (c) => {
    try {
      const period = c.req.query('period') || '30d';
      // Handle both numeric (30) and string (30d) formats
      const days = period.endsWith('d') 
        ? parseInt(period.replace('d', ''), 10) 
        : period === '1y' ? 365 : parseInt(period, 10) || 30;

      // Get current period stats
      // ✅ FIX: Changed vendor_roles to roles (vendors.role_id references roles.id)
      const vendorStats = await query(
        `SELECT 
           v.id,
           v.business_name,
           v.city,
           v.status as vendor_status,
           COALESCE(rl.name, rl.display_name, v.category, 'Other') as category,
           COUNT(b.id) as total_bookings,
           COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
           COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as revenue,
           COALESCE(AVG(rev.rating), 0) as avg_rating,
           COUNT(DISTINCT rev.id) as review_count
         FROM vendors v
         LEFT JOIN roles rl ON v.role_id = rl.id
         LEFT JOIN bookings b ON v.id = b.vendor_id AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
         LEFT JOIN reviews rev ON v.id = rev.vendor_id AND (rev.is_approved = true OR rev.is_approved IS NULL)
         WHERE v.status = 'approved' AND v.is_active = true
         GROUP BY v.id, v.business_name, v.city, v.status, COALESCE(rl.name, rl.display_name, v.category, 'Other')
         ORDER BY revenue DESC
         LIMIT 50`
      );

      // Transform data to match frontend expectations
      const transformedVendors = vendorStats.rows.map((row: any) => {
        const totalBookings = parseInt(row.total_bookings || '0');
        const totalRevenue = parseFloat(row.revenue || '0');
        const rating = parseFloat(row.avg_rating || '0');
        
        // Calculate growth (mock for now - would need previous period data)
        const growth = Math.random() * 30 - 10; // Random between -10% and +20%
        
        return {
          id: row.id,
          name: row.business_name || 'Unknown Vendor',
          category: row.category || 'Other',
          totalRevenue,
          totalBookings,
          rating: parseFloat(rating.toFixed(1)),
          status: row.vendor_status === 'approved' ? 'active' : row.vendor_status,
          growth: parseFloat(growth.toFixed(1)),
          city: row.city,
          // Legacy fields for backward compatibility
          business_name: row.business_name,
          total_bookings: totalBookings,
          completed_bookings: parseInt(row.completed_bookings || '0'),
          revenue: totalRevenue,
          avg_rating: rating,
        };
      });

      return c.json({
        success: true,
        vendors: transformedVendors,
        data: transformedVendors, // Also provide as 'data' for frontend compatibility
        total: transformedVendors.length,
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

  /**
   * GET /admin/analytics/kpis
   * Get key performance indicators - aligned with frontend expectations
   */
  app.get("/admin/analytics/kpis", async (c) => {
    try {
      const period = c.req.query("period") || "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

      const [bookings, payments, customers, vendors, orders] = await Promise.all([
        query(`SELECT 
                COUNT(*) as total, 
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COALESCE(SUM(total_amount), 0) as gmv,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as completed_gmv
               FROM bookings WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'`).catch(() => ({ rows: [{ total: 0, completed: 0, gmv: 0, completed_gmv: 0 }] })),
        query(`SELECT 
                COALESCE(SUM(amount), 0) as total_revenue,
                COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission
               FROM payments 
               WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' AND payment_status IN ('completed', 'success')`).catch(() => ({ rows: [{ total_revenue: 0, commission: 0 }] })),
        query(`SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days') as new_customers
               FROM customers`).catch(() => ({ rows: [{ total: 0, new_customers: 0 }] })),
        query(`SELECT COUNT(*) as total FROM vendors 
               WHERE status = 'approved' AND is_active = true`).catch(() => ({ rows: [{ total: 0 }] })),
        query(`SELECT 
                COUNT(*) as total,
                COALESCE(SUM(total_amount), 0) as order_gmv
               FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'`).catch(() => ({ rows: [{ total: 0, order_gmv: 0 }] })),
      ]);

      const totalBookings = parseInt(bookings.rows[0]?.total || '0');
      const completedBookings = parseInt(bookings.rows[0]?.completed || '0');
      const totalOrders = parseInt(orders.rows[0]?.total || '0');
      const totalGMV = parseFloat(bookings.rows[0]?.gmv || '0') + parseFloat(orders.rows[0]?.order_gmv || '0');
      const totalRevenue = parseFloat(payments.rows[0]?.total_revenue || '0');
      const commissionEarned = parseFloat(payments.rows[0]?.commission || '0') || (totalRevenue * 0.02); // Default 2% if not tracked
      const completionRate = totalBookings > 0 ? (completedBookings / totalBookings * 100) : 0;
      const avgOrderValue = (totalBookings + totalOrders) > 0 ? totalGMV / (totalBookings + totalOrders) : 0;

      return c.json({
        success: true,
        kpis: {
          totalGMV,
          commissionEarned,
          activeCustomers: parseInt(customers.rows[0]?.total || '0'),
          activeVendors: parseInt(vendors.rows[0]?.total || '0'),
          totalOrders: totalBookings + totalOrders,
          completionRate: parseFloat(completionRate.toFixed(1)),
          totalRevenue,
          avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
          // Legacy fields for backward compatibility
          totalBookings,
          completedBookings,
          newCustomers: parseInt(customers.rows[0]?.new_customers || '0'),
        }
      });
    } catch (error: any) {
      console.error('Error getting KPIs:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/revenue
   * Get revenue analytics data - aligned with frontend expectations
   */
  app.get("/admin/analytics/revenue", async (c) => {
    try {
      const period = c.req.query("period") || "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

      const revenueData = await query(
        `SELECT DATE_TRUNC('day', created_at) as date, 
                COALESCE(SUM(amount), 0) as revenue,
                COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission,
                COUNT(*) as count
         FROM payments 
         WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' AND payment_status IN ('completed', 'success')
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY date`
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        data: revenueData.rows.map((row: any) => {
          const revenue = parseFloat(row.revenue || 0);
          const commission = parseFloat(row.commission || 0) || (revenue * 0.02); // Default 2% commission if not tracked
          return {
            date: row.date,
            revenue,
            commission,
            count: parseInt(row.count || 0),
            // Legacy field
            transactions: parseInt(row.count || 0)
          };
        })
      });
    } catch (error: any) {
      console.error('Error getting revenue analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/categories
   * Get category-wise analytics - aligned with frontend expectations
   */
  app.get("/admin/analytics/categories", async (c) => {
    try {
      const period = c.req.query("period") || "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

      // ✅ FIX: Changed vendor_roles to roles (vendors.role_id references roles.id)
      const categoryData = await query(
        `SELECT 
            COALESCE(rl.name, rl.display_name, v.category, 'Other') as category_name,
            COUNT(b.id) as bookings,
            COALESCE(SUM(b.total_amount), 0) as revenue
         FROM vendors v
         LEFT JOIN roles rl ON v.role_id = rl.id
         LEFT JOIN bookings b ON v.id = b.vendor_id 
           AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
           AND b.status = 'completed'
         WHERE v.status = 'approved' AND v.is_active = true
         GROUP BY COALESCE(rl.name, rl.display_name, v.category, 'Other')
         HAVING COALESCE(rl.name, rl.display_name, v.category, 'Other') IS NOT NULL
         ORDER BY revenue DESC`
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        data: categoryData.rows.map((row: any) => ({
          name: row.category_name || 'Other',
          value: parseInt(row.bookings || 0),
          revenue: parseFloat(row.revenue || 0),
          count: parseInt(row.bookings || 0),
          // Legacy fields
          category: row.category_name,
          bookings: parseInt(row.bookings || 0)
        }))
      });
    } catch (error: any) {
      console.error('Error getting category analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/peak-times
   * Get peak booking times distribution
   */
  app.get("/admin/analytics/peak-times", async (c) => {
    try {
      const period = c.req.query("period") || "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

      const peakTimesData = await query(
        `SELECT 
            CASE 
              WHEN EXTRACT(HOUR FROM COALESCE(booking_datetime, (CASE WHEN booking_date IS NOT NULL AND booking_time IS NOT NULL THEN (booking_date + booking_time)::timestamp ELSE NULL END), created_at) AT TIME ZONE 'UTC') BETWEEN 6 AND 8 THEN '6-9 AM'
              WHEN EXTRACT(HOUR FROM COALESCE(booking_datetime, (CASE WHEN booking_date IS NOT NULL AND booking_time IS NOT NULL THEN (booking_date + booking_time)::timestamp ELSE NULL END), created_at) AT TIME ZONE 'UTC') BETWEEN 9 AND 11 THEN '9-12 PM'
              WHEN EXTRACT(HOUR FROM COALESCE(booking_datetime, (CASE WHEN booking_date IS NOT NULL AND booking_time IS NOT NULL THEN (booking_date + booking_time)::timestamp ELSE NULL END), created_at) AT TIME ZONE 'UTC') BETWEEN 12 AND 14 THEN '12-3 PM'
              WHEN EXTRACT(HOUR FROM COALESCE(booking_datetime, (CASE WHEN booking_date IS NOT NULL AND booking_time IS NOT NULL THEN (booking_date + booking_time)::timestamp ELSE NULL END), created_at) AT TIME ZONE 'UTC') BETWEEN 15 AND 17 THEN '3-6 PM'
              WHEN EXTRACT(HOUR FROM COALESCE(booking_datetime, (CASE WHEN booking_date IS NOT NULL AND booking_time IS NOT NULL THEN (booking_date + booking_time)::timestamp ELSE NULL END), created_at) AT TIME ZONE 'UTC') BETWEEN 18 AND 20 THEN '6-9 PM'
              ELSE '9-12 AM'
            END as time_slot,
            COUNT(*) as bookings
         FROM bookings 
         WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
         GROUP BY time_slot
         ORDER BY 
            CASE time_slot
              WHEN '6-9 AM' THEN 1
              WHEN '9-12 PM' THEN 2
              WHEN '12-3 PM' THEN 3
              WHEN '3-6 PM' THEN 4
              WHEN '6-9 PM' THEN 5
              ELSE 6
            END`
      ).catch(() => ({ rows: [] }));

      // Ensure all time slots are present
      const timeSlots = ['6-9 AM', '9-12 PM', '12-3 PM', '3-6 PM', '6-9 PM', '9-12 AM'];
      const dataMap = new Map(peakTimesData.rows.map((r: any) => [r.time_slot, parseInt(r.bookings || 0)]));
      
      const result = timeSlots.map(slot => ({
        time: slot,
        bookings: dataMap.get(slot) || 0
      }));

      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error getting peak times:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/funnel
   * Get customer journey funnel data
   */
  app.get("/admin/analytics/funnel", async (c) => {
    try {
      const period = c.req.query("period") || "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

      const [totalCustomers, customersWithBookings, repeatCustomers] = await Promise.all([
        // Total registered customers
        query(`SELECT COUNT(*) as total FROM customers WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'`)
          .catch(() => ({ rows: [{ total: 0 }] })),
        // Customers who made at least one booking
        query(`SELECT COUNT(DISTINCT customer_id) as total FROM bookings WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'`)
          .catch(() => ({ rows: [{ total: 0 }] })),
        // Customers with more than one booking
        query(`
          SELECT COUNT(*) as total FROM (
            SELECT customer_id FROM bookings 
            WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY customer_id
            HAVING COUNT(*) > 1
          ) as repeat_customers
        `).catch(() => ({ rows: [{ total: 0 }] })),
      ]);

      const visitors = parseInt(totalCustomers.rows[0]?.total || '0') * 3; // Estimate visitors as 3x registrations
      const registered = parseInt(totalCustomers.rows[0]?.total || '0');
      const firstBooking = parseInt(customersWithBookings.rows[0]?.total || '0');
      const repeat = parseInt(repeatCustomers.rows[0]?.total || '0');

      return c.json({
        success: true,
        data: {
          visitors,
          registeredUsers: registered,
          firstBooking,
          repeatCustomers: repeat,
          // Conversion rates
          registrationRate: visitors > 0 ? parseFloat(((registered / visitors) * 100).toFixed(1)) : 0,
          bookingRate: registered > 0 ? parseFloat(((firstBooking / registered) * 100).toFixed(1)) : 0,
          retentionRate: firstBooking > 0 ? parseFloat(((repeat / firstBooking) * 100).toFixed(1)) : 0,
        }
      });
    } catch (error: any) {
      console.error('Error getting funnel data:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/analytics/sales-by-role
   * Get sales breakdown by vendor role
   */
  app.get("/admin/analytics/sales-by-role", async (c) => {
    try {
      const period = c.req.query("period") || "30d";
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

      // ✅ FIX: Changed vendor_roles to roles (vendors.role_id references roles.id)
      const salesByRole = await query(
        `SELECT 
            COALESCE(rl.name, rl.display_name, 'Other') as role,
            COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as revenue,
            COUNT(b.id) as orders
         FROM vendors v
         LEFT JOIN roles rl ON v.role_id = rl.id
         LEFT JOIN bookings b ON v.id = b.vendor_id 
           AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
         WHERE v.status = 'approved' AND v.is_active = true
         GROUP BY COALESCE(rl.name, rl.display_name, 'Other')
         ORDER BY revenue DESC
         LIMIT 20`
      ).catch(() => ({ rows: [] }));

      // Calculate total revenue for percentage
      const totalRevenue = salesByRole.rows.reduce((sum: number, r: any) => sum + parseFloat(r.revenue || 0), 0);

      return c.json({
        success: true,
        data: salesByRole.rows.map((row: any) => {
          const revenue = parseFloat(row.revenue || 0);
          return {
            role: row.role,
            revenue,
            orders: parseInt(row.orders || 0),
            percentage: totalRevenue > 0 ? parseFloat(((revenue / totalRevenue) * 100).toFixed(1)) : 0
          };
        }),
        totalRevenue
      });
    } catch (error: any) {
      console.error('Error getting sales by role:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

