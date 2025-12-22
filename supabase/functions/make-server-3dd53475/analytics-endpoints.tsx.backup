import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

export function analyticsEndpoints(app: Hono, kv: any) {
  
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
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get bookings
      const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
      
      let totalBookings = 0;
      let pendingBookings = 0;
      let confirmedBookings = 0;
      let completedBookings = 0;
      let cancelledBookings = 0;
      let totalRevenue = 0;
      let thisMonthRevenue = 0;
      let todayBookings = 0;
      
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().substring(0, 7);
      
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          totalBookings++;
          
          switch (booking.status) {
            case 'pending': pendingBookings++; break;
            case 'confirmed': confirmedBookings++; break;
            case 'completed': 
              completedBookings++;
              totalRevenue += booking.price || 0;
              if (booking.bookingDate?.startsWith(thisMonth)) {
                thisMonthRevenue += booking.price || 0;
              }
              break;
            case 'cancelled': cancelledBookings++; break;
          }
          
          if (booking.bookingDate === today) {
            todayBookings++;
          }
        }
      }

      // Get reviews
      const reviewIds = await kv.get(`vendor:${vendorId}:reviews`) || [];
      const totalReviews = reviewIds.length;

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
   */
  app.get("/make-server-3dd53475/analytics/customer/:customerId/dashboard", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Get pets
      const petIds = await kv.get(`customer:${customerId}:pets`) || [];
      const totalPets = petIds.length;

      // Get bookings
      const bookingIds = await kv.get(`customer:${customerId}:bookings`) || [];
      
      let totalBookings = 0;
      let upcomingBookings = 0;
      let completedBookings = 0;
      let totalSpent = 0;
      
      const now = new Date();
      
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          totalBookings++;
          
          if (booking.status === 'completed') {
            completedBookings++;
            totalSpent += booking.price || 0;
          }
          
          if (booking.status === 'confirmed' || booking.status === 'pending') {
            const bookingDate = new Date(booking.bookingDate);
            if (bookingDate >= now) {
              upcomingBookings++;
            }
          }
        }
      }

      // Get reviews
      const reviewIds = await kv.get(`customer:${customerId}:reviews`) || [];
      const totalReviews = reviewIds.length;

      // Get favorite vendors
      const favoriteVendors = customer.favoriteVendors || [];

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
      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const totalVendors = allVendors.length;
      const activeVendors = allVendors.filter((v: any) => v.status === 'approved' && v.isActive).length;
      const pendingVendors = allVendors.filter((v: any) => v.status === 'pending_approval').length;

      // Get all customers
      const allCustomers = await kv.getByPrefix('customer:customer_');
      const totalCustomers = allCustomers.length;

      // Get all bookings
      const allBookings = await kv.getByPrefix('booking:booking_');
      const totalBookings = allBookings.length;
      const completedBookings = allBookings.filter((b: any) => b.status === 'completed').length;
      const pendingBookings = allBookings.filter((b: any) => b.status === 'pending').length;

      // Calculate revenue
      let totalRevenue = 0;
      let platformCommission = 0;
      
      for (const booking of allBookings) {
        if (booking.status === 'completed' && booking.price) {
          totalRevenue += booking.price;
          // Assuming 10% platform commission
          platformCommission += booking.price * 0.10;
        }
      }

      // Get all reviews
      const allReviews = await kv.getByPrefix('review:review_');
      const totalReviews = allReviews.length;

      // Calculate average platform rating
      let totalRating = 0;
      let ratingCount = 0;
      for (const review of allReviews) {
        if (review.status === 'published' && review.rating) {
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
   */
  app.get("/make-server-3dd53475/analytics/vendor/:vendorId/revenue", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year

      const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
      
      const revenueByPeriod: { [key: string]: number } = {};
      let totalRevenue = 0;
      
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking && booking.status === 'completed' && booking.completedAt) {
          const date = new Date(booking.completedAt);
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
          
          revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + (booking.price || 0);
          totalRevenue += booking.price || 0;
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
      const allBookings = await kv.getByPrefix('booking:booking_');
      
      const bookingsByPeriod: { [key: string]: number } = {};
      
      for (const booking of allBookings) {
        if (booking.createdAt) {
          const date = new Date(booking.createdAt);
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
      const allBookings = await kv.getByPrefix('booking:booking_');
      
      const serviceCount: { [key: string]: number } = {};
      const serviceRevenue: { [key: string]: number } = {};
      
      for (const booking of allBookings) {
        if (booking.serviceType || booking.serviceName) {
          const service = booking.serviceType || booking.serviceName;
          serviceCount[service] = (serviceCount[service] || 0) + 1;
          
          if (booking.status === 'completed' && booking.price) {
            serviceRevenue[service] = (serviceRevenue[service] || 0) + booking.price;
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
