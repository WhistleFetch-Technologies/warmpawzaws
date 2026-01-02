import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
// ✅ SQL MIGRATION: Replace KV with SQL repositories
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors";
import { getBookingsRepository } from "../../../supabase/lib/repositories/bookings";
import { getReviewsRepository } from "../../../supabase/lib/repositories/reviews";
import { getCustomersRepository } from "../../../supabase/lib/repositories/customers";
import { getPetsRepository } from "../../../supabase/lib/repositories/pets";

export function analyticsEndpoints(app: Hono) {
  
  // ============================================
  // ANALYTICS & REPORTS ENDPOINTS
  // ============================================
  
  /**
   * Get vendor dashboard statistics
   * GET /make-server-3dd53475/analytics/vendor/:vendorId/dashboard
   */
  app.get("/make-server-3dd53475/analytics/vendor/:vendorId/dashboard", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor from repository
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get all bookings for vendor
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
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
            const revenue = booking.total_amount || 0;
            totalRevenue += revenue;
            if (booking.booking_date?.startsWith(thisMonth)) {
              thisMonthRevenue += revenue;
            }
            break;
          case 'cancelled': cancelledBookings++; break;
        }
        
        if (booking.booking_date === today) {
          todayBookings++;
        }
      }

      // ✅ SQL: Get reviews count for vendor
      const reviewsRepo = getReviewsRepository();
      const reviews = await reviewsRepo.findByVendor(vendorId);
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
          rating: reviews.length > 0 
            ? parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2))
            : 0,
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
   */
  app.get("/make-server-3dd53475/analytics/customer/:customerId/dashboard", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      // ✅ SQL: Get customer from repository
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(customerId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // ✅ SQL: Get pets for customer
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findByCustomer(customerId);
      const totalPets = pets.length;

      // ✅ SQL: Get bookings for customer
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByCustomer(customerId);
      
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

      // ✅ SQL: Get reviews count for customer
      const reviewsRepo = getReviewsRepository();
      const reviews = await reviewsRepo.findByCustomer(customerId);
      const totalReviews = reviews.length;

      // Get favorite vendors (may be stored in customer preferences)
      const favoriteVendors = customer.preferences?.favorite_vendors || [];

      const stats = {
        overview: {
          totalPets,
          totalBookings,
          upcomingBookings,
          completedBookings,
          totalReviews,
          favoriteVendors: favoriteVendors.length
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
   */
  app.get("/make-server-3dd53475/analytics/admin/platform", async (c) => {
    try {
      // ✅ SQL: Get all vendors
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll();
      const totalVendors = allVendors.length;
      const activeVendors = allVendors.filter(v => v.status === 'approved' && v.is_active).length;
      const pendingVendors = allVendors.filter(v => v.status === 'pending_approval').length;

      // ✅ SQL: Get all customers
      const customersRepo = getCustomersRepository();
      const allCustomers = await customersRepo.findAll();
      const totalCustomers = allCustomers.length;

      // ✅ SQL: Get all bookings
      const bookingsRepo = getBookingsRepository();
      const allBookings = await bookingsRepo.findAll();
      const totalBookings = allBookings.length;
      const completedBookings = allBookings.filter(b => b.status === 'completed').length;
      const pendingBookings = allBookings.filter(b => b.status === 'pending').length;

      // Calculate revenue
      let totalRevenue = 0;
      let platformCommission = 0;
      
      for (const booking of allBookings) {
        if (booking.status === 'completed') {
          const revenue = booking.total_amount || 0;
          totalRevenue += revenue;
          // Assuming 10% platform commission
          platformCommission += revenue * 0.10;
        }
      }

      // ✅ SQL: Get all reviews
      const reviewsRepo = getReviewsRepository();
      const allReviews = await reviewsRepo.findAll();
      const totalReviews = allReviews.length;

      // Calculate average platform rating
      const averagePlatformRating = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

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
   */
  app.get("/make-server-3dd53475/analytics/vendor/:vendorId/revenue", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year

      // ✅ SQL: Get all bookings for vendor
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
      const revenueByPeriod: { [key: string]: number } = {};
      let totalRevenue = 0;
      
      for (const booking of bookings) {
        if (booking.status === 'completed' && booking.completed_at) {
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
          
          const revenue = booking.total_amount || 0;
          revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + revenue;
          totalRevenue += revenue;
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
   */
  app.get("/make-server-3dd53475/analytics/admin/trends/bookings", async (c) => {
    try {
      const period = c.req.query('period') || 'month';
      // ✅ SQL: Get all bookings
      const bookingsRepo = getBookingsRepository();
      const allBookings = await bookingsRepo.findAll();
      
      const bookingsByPeriod: { [key: string]: number } = {};
      
      for (const booking of allBookings) {
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
        totalBookings: allBookings.length,
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
   */
  app.get("/make-server-3dd53475/analytics/admin/service-popularity", async (c) => {
    try {
      // ✅ SQL: Get all bookings
      const bookingsRepo = getBookingsRepository();
      const allBookings = await bookingsRepo.findAll();
      
      const serviceCount: { [key: string]: number } = {};
      const serviceRevenue: { [key: string]: number } = {};
      
      for (const booking of allBookings) {
        if (booking.service_type) {
          const service = booking.service_type;
          serviceCount[service] = (serviceCount[service] || 0) + 1;
          
          if (booking.status === 'completed') {
            const revenue = booking.total_amount || 0;
            serviceRevenue[service] = (serviceRevenue[service] || 0) + revenue;
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

  console.log('✅ Analytics endpoints registered');
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
