/**
 * ============================================================================
 * ANALYTICS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Analytics & reporting endpoints:
 * - Vendor dashboard statistics
 * - Customer dashboard statistics
 * - Admin platform statistics
 * - Revenue reports
 * - Booking trends
 * - Service popularity
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getCommissionsRepository } from "../../lib/repositories/commissions.ts";
import { getDbClient } from "../../lib/db.ts";

export function analyticsEndpoints(app: Hono) {
  
  // ============================================
  // ANALYTICS & REPORTS ENDPOINTS
  // ============================================
  
  /**
   * Get vendor dashboard statistics
   * GET /make-server-3dd53475/analytics/vendor/:vendorId/dashboard
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/analytics/vendor/:vendorId/dashboard", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get all bookings for vendor
      const bookings = await getBookingsRepository().findByVendor(vendorId);
      
      let totalBookings = bookings.length;
      let pendingBookings = 0;
      let confirmedBookings = 0;
      let completedBookings = 0;
      let cancelledBookings = 0;
      let totalRevenue = 0;
      let thisMonthRevenue = 0;
      let todayBookings = 0;
      
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().substring(0, 7);
      
      for (const booking of bookings) {
        switch (booking.status) {
          case 'pending': pendingBookings++; break;
          case 'confirmed': confirmedBookings++; break;
          case 'completed': 
            completedBookings++;
            totalRevenue += booking.total_amount || 0;
            if (booking.booking_date?.startsWith(thisMonth)) {
              thisMonthRevenue += booking.total_amount || 0;
            }
            break;
          case 'cancelled': cancelledBookings++; break;
        }
        
        if (booking.booking_date === today) {
          todayBookings++;
        }
      }

      // ✅ SQL: Get reviews for vendor
      const reviews = await getReviewsRepository().findByVendor(vendorId);
      const totalReviews = reviews.length;

      // Response rate (confirmed / total requests)
      const responseRate = totalBookings > 0 
        ? ((confirmedBookings + completedBookings) / totalBookings * 100).toFixed(1)
        : 0;

      const stats = {
        overview: {
          totalBookings,
          pendingBookings,
          confirmedBookings,
          completedBookings,
          cancelledBookings,
          todayBookings,
          rating: vendor.rating || 0,
          totalReviews,
          responseRate: parseFloat(responseRate as string)
        },
        revenue: {
          total: totalRevenue,
          thisMonth: thisMonthRevenue,
          average: completedBookings > 0 ? totalRevenue / completedBookings : 0
        },
        performance: {
          completionRate: totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0,
          cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings * 100).toFixed(1) : 0
        }
      };

      return sendSuccess(c, { stats });
    } catch (error) {
      console.error('Error getting vendor dashboard:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer dashboard statistics
   * GET /make-server-3dd53475/analytics/customer/:customerId/dashboard
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/analytics/customer/:customerId/dashboard", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      // ✅ SQL: Get customer
      const customer = await getCustomersRepository().findById(customerId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // ✅ SQL: Get pets for customer
      const { getPetsRepository } = await import('../../lib/repositories/pets.ts');
      const pets = await getPetsRepository().findByCustomer(customerId);
      const totalPets = pets.length;

      // ✅ SQL: Get bookings for customer
      const bookings = await getBookingsRepository().findByCustomer(customerId);
      
      let totalBookings = bookings.length;
      let upcomingBookings = 0;
      let completedBookings = 0;
      let totalSpent = 0;
      
      const now = new Date();
      
      for (const booking of bookings) {
        if (booking.status === 'completed') {
          completedBookings++;
          totalSpent += booking.total_amount || 0;
        }
        
        if (booking.status === 'confirmed' || booking.status === 'pending') {
          const bookingDate = new Date(booking.booking_date);
          if (bookingDate >= now) {
            upcomingBookings++;
          }
        }
      }

      // ✅ SQL: Get reviews for customer
      const reviews = await getReviewsRepository().findByCustomer(customerId);
      const totalReviews = reviews.length;

      const stats = {
        overview: {
          totalPets,
          totalBookings,
          upcomingBookings,
          completedBookings,
          totalReviews,
          favoriteVendors: 0 // TODO: Add favorite vendors feature
        },
        spending: {
          total: totalSpent,
          average: completedBookings > 0 ? totalSpent / completedBookings : 0
        }
      };

      return sendSuccess(c, { stats });
    } catch (error) {
      console.error('Error getting customer dashboard:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get admin platform statistics
   * GET /make-server-3dd53475/analytics/admin/platform
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/analytics/admin/platform", async (c) => {
    try {
      const client = getDbClient();
      
      // ✅ SQL: Get all vendors
      const { data: vendors } = await client
        .from('vendors')
        .select('id, status, is_active');
      const totalVendors = vendors?.length || 0;
      const activeVendors = vendors?.filter(v => v.status === 'approved' && v.is_active).length || 0;
      const pendingVendors = vendors?.filter(v => v.status === 'pending_approval').length || 0;

      // ✅ SQL: Get all customers
      const { data: customers } = await client
        .from('customers')
        .select('id');
      const totalCustomers = customers?.length || 0;

      // ✅ SQL: Get all bookings
      const { data: bookings } = await client
        .from('bookings')
        .select('id, status, total_amount');
      const totalBookings = bookings?.length || 0;
      const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0;
      const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0;

      // Calculate revenue
      let totalRevenue = 0;
      let platformCommission = 0;
      
      for (const booking of bookings || []) {
        if (booking.status === 'completed' && booking.total_amount) {
          totalRevenue += booking.total_amount;
          // Get commission from commissions table
          const commissions = await getCommissionsRepository().findByBooking(booking.id);
          if (commissions.length > 0) {
            platformCommission += commissions[0].commission_amount || 0;
          } else {
            // Fallback: assume 10% commission
            platformCommission += booking.total_amount * 0.10;
          }
        }
      }

      // ✅ SQL: Get all reviews
      const { data: reviews } = await client
        .from('reviews')
        .select('id, rating');
      const totalReviews = reviews?.length || 0;

      // Calculate average platform rating
      let totalRating = 0;
      let ratingCount = 0;
      for (const review of reviews || []) {
        if (review.rating) {
          totalRating += review.rating;
          ratingCount++;
        }
      }
      const averagePlatformRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      const stats = {
        users: {
          totalVendors,
          activeVendors,
          pendingVendors,
          totalCustomers
        },
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          pending: pendingBookings,
          completionRate: totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0
        },
        revenue: {
          total: totalRevenue,
          platformCommission,
          averageBookingValue: completedBookings > 0 ? totalRevenue / completedBookings : 0
        },
        reviews: {
          total: totalReviews,
          averageRating: parseFloat(averagePlatformRating.toFixed(2))
        }
      };

      return sendSuccess(c, { stats });
    } catch (error) {
      console.error('Error getting platform stats:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor revenue report
   * GET /make-server-3dd53475/analytics/vendor/:vendorId/revenue
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/analytics/vendor/:vendorId/revenue", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year

      // ✅ SQL: Get commissions for vendor (completed bookings)
      const commissions = await getCommissionsRepository().findByVendor(vendorId);
      
      const revenueByPeriod: { [key: string]: number } = {};
      let totalRevenue = 0;
      
      for (const commission of commissions) {
        const booking = await getBookingsRepository().findById(commission.booking_id || '');
        if (booking && booking.status === 'completed' && booking.completed_at) {
          const date = new Date(booking.completed_at);
          let periodKey = '';
          
          switch (period) {
            case 'day':
              periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
              break;
            case 'week':
              const weekNum = getWeekNumber(date);
              periodKey = `${date.getFullYear()}-W${weekNum}`;
              break;
            case 'month':
              periodKey = date.toISOString().substring(0, 7); // YYYY-MM
              break;
            case 'year':
              periodKey = date.getFullYear().toString();
              break;
          }
          
          revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + (commission.vendor_amount || 0);
          totalRevenue += commission.vendor_amount || 0;
        }
      }

      const report = {
        period,
        totalRevenue,
        breakdown: revenueByPeriod,
        periods: Object.keys(revenueByPeriod).sort()
      };

      return sendSuccess(c, { report });
    } catch (error) {
      console.error('Error getting revenue report:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get booking trends
   * GET /make-server-3dd53475/analytics/admin/trends/bookings
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/analytics/admin/trends/bookings", async (c) => {
    try {
      const period = c.req.query('period') || 'month';
      const client = getDbClient();
      
      // ✅ SQL: Get all bookings
      const { data: bookings } = await client
        .from('bookings')
        .select('id, created_at');
      
      const bookingsByPeriod: { [key: string]: number } = {};
      
      for (const booking of bookings || []) {
        if (booking.created_at) {
          const date = new Date(booking.created_at);
          let periodKey = '';
          
          switch (period) {
            case 'day':
              periodKey = date.toISOString().split('T')[0];
              break;
            case 'week':
              const weekNum = getWeekNumber(date);
              periodKey = `${date.getFullYear()}-W${weekNum}`;
              break;
            case 'month':
              periodKey = date.toISOString().substring(0, 7);
              break;
            case 'year':
              periodKey = date.getFullYear().toString();
              break;
          }
          
          bookingsByPeriod[periodKey] = (bookingsByPeriod[periodKey] || 0) + 1;
        }
      }

      const trends = {
        period,
        totalBookings: bookings?.length || 0,
        breakdown: bookingsByPeriod,
        periods: Object.keys(bookingsByPeriod).sort()
      };

      return sendSuccess(c, { trends });
    } catch (error) {
      console.error('Error getting booking trends:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get service popularity report
   * GET /make-server-3dd53475/analytics/admin/service-popularity
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/analytics/admin/service-popularity", async (c) => {
    try {
      const client = getDbClient();
      
      // ✅ SQL: Get all bookings with service info
      const { data: bookings } = await client
        .from('bookings')
        .select('id, service_type, total_amount, status');
      
      const serviceCount: { [key: string]: number } = {};
      const serviceRevenue: { [key: string]: number } = {};
      
      for (const booking of bookings || []) {
        if (booking.service_type) {
          const service = booking.service_type;
          serviceCount[service] = (serviceCount[service] || 0) + 1;
          
          if (booking.status === 'completed' && booking.total_amount) {
            serviceRevenue[service] = (serviceRevenue[service] || 0) + booking.total_amount;
          }
        }
      }

      const services = Object.keys(serviceCount).map(service => ({
        name: service,
        bookings: serviceCount[service],
        revenue: serviceRevenue[service] || 0,
        averagePrice: serviceCount[service] > 0 
          ? (serviceRevenue[service] || 0) / serviceCount[service]
          : 0
      })).sort((a, b) => b.bookings - a.bookings);

      return sendSuccess(c, { services, total: services.length });
    } catch (error) {
      console.error('Error getting service popularity:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Analytics endpoints registered (SQL-only)');
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

