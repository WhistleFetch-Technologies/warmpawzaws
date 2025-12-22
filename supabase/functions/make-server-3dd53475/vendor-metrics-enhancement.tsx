import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * ✅ GAP #8 FIX: VENDOR DASHBOARD METRICS ENHANCEMENT
 * Production-ready comprehensive vendor analytics
 * 
 * Fixes missing TODOs:
 * - Real-time service counting (totalServices, activeServices)
 * - Staff utilization metrics
 * - Package enrollment tracking
 * - Revenue analytics by service
 * - Customer acquisition metrics
 * - Conversion rate tracking
 * - Growth trends
 */

export function registerVendorMetricsEnhancement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // ENHANCED DASHBOARD OVERVIEW
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/metrics/overview`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'month'; // today, week, month, year

      console.log(`📊 [VENDOR METRICS] Fetching overview for: ${vendorId}, timeframe: ${timeframe}`);

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case 'today':
          startDate = new Date(now.toISOString().split('T')[0]);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      // ============================================
      // 1. SERVICE METRICS (✅ FIXES TODO)
      // ============================================
      const servicesMetrics = await calculateServiceMetrics(vendorId);

      // ============================================
      // 2. STAFF METRICS
      // ============================================
      const staffMetrics = await calculateStaffMetrics(vendorId);

      // ============================================
      // 3. BOOKING METRICS
      // ============================================
      const bookingMetrics = await calculateBookingMetrics(vendorId, startDate);

      // ============================================
      // 4. REVENUE METRICS
      // ============================================
      const revenueMetrics = await calculateRevenueMetrics(vendorId, startDate);

      // ============================================
      // 5. PACKAGE METRICS
      // ============================================
      const packageMetrics = await calculatePackageMetrics(vendorId);

      // ============================================
      // 6. CUSTOMER METRICS
      // ============================================
      const customerMetrics = await calculateCustomerMetrics(vendorId, startDate);

      // ============================================
      // 7. PERFORMANCE METRICS
      // ============================================
      const performanceMetrics = await calculatePerformanceMetrics(vendorId, startDate);

      console.log(`✅ [VENDOR METRICS] Overview calculated for ${vendorId}`);

      return sendSuccess(c, {
        vendorId,
        timeframe,
        period: {
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        },
        services: servicesMetrics,
        staff: staffMetrics,
        bookings: bookingMetrics,
        revenue: revenueMetrics,
        packages: packageMetrics,
        customers: customerMetrics,
        performance: performanceMetrics,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [VENDOR METRICS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // =============================================
  // SERVICE PERFORMANCE BREAKDOWN
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/metrics/services`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'month';

      console.log(`📊 [SERVICE METRICS] Vendor: ${vendorId}`);

      // Get all services
      const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
      
      const servicePerformance = [];

      for (const serviceId of serviceIds) {
        const service = await kv.get(`service:${serviceId}`);
        if (!service) continue;

        // Get bookings for this service
        const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
        const serviceBookings = [];

        for (const bookingId of bookingIds) {
          const booking = await kv.get(`booking:${bookingId}`);
          if (booking && booking.serviceId === serviceId) {
            serviceBookings.push(booking);
          }
        }

        // Calculate metrics
        const totalBookings = serviceBookings.length;
        const completedBookings = serviceBookings.filter(b => b.status === 'completed').length;
        const totalRevenue = serviceBookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.price || 0), 0);
        const avgRating = service.avgRating || 0;
        const conversionRate = totalBookings > 0 ? (completedBookings / totalBookings * 100) : 0;

        servicePerformance.push({
          serviceId,
          serviceName: service.name,
          category: service.category,
          price: service.price,
          isActive: service.isActive,
          metrics: {
            totalBookings,
            completedBookings,
            totalRevenue,
            avgRevenue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
            avgRating,
            conversionRate: Number(conversionRate.toFixed(1))
          }
        });
      }

      // Sort by revenue (highest first)
      servicePerformance.sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue);

      return sendSuccess(c, {
        services: servicePerformance,
        total: servicePerformance.length,
        topPerformer: servicePerformance[0] || null
      });

    } catch (error) {
      console.error('❌ [SERVICE METRICS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // =============================================
  // STAFF PERFORMANCE BREAKDOWN
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/metrics/staff`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`📊 [STAFF METRICS] Vendor: ${vendorId}`);

      const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
      const staffPerformance = [];

      for (const staffId of staffIds) {
        if (typeof staffId !== 'string' || staffId.startsWith('staffsvc_')) continue;

        const staff = await kv.get(`staff:${staffId}`);
        if (!staff || staff.isActive === false) continue;

        // Get bookings assigned to this staff
        const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
        const staffBookings = [];

        for (const bookingId of bookingIds) {
          const booking = await kv.get(`booking:${bookingId}`);
          if (booking && (booking.doctorId === staffId || booking.staffId === staffId)) {
            staffBookings.push(booking);
          }
        }

        // Get staff services
        const staffServices = await kv.getByPrefix(`staff:${staffId}:service:`) || [];

        // Calculate metrics
        const totalBookings = staffBookings.length;
        const completedBookings = staffBookings.filter(b => b.status === 'completed').length;
        const totalRevenue = staffBookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.price || 0), 0);
        const utilization = totalBookings > 0 ? (completedBookings / totalBookings * 100) : 0;

        staffPerformance.push({
          staffId,
          name: staff.name,
          role: staff.role,
          specialization: staff.specialization,
          metrics: {
            assignedServices: staffServices.length,
            totalBookings,
            completedBookings,
            totalRevenue,
            avgRevenuePerBooking: completedBookings > 0 ? totalRevenue / completedBookings : 0,
            utilizationRate: Number(utilization.toFixed(1)),
            rating: staff.rating || 0
          }
        });
      }

      // Sort by revenue
      staffPerformance.sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue);

      return sendSuccess(c, {
        staff: staffPerformance,
        total: staffPerformance.length,
        topPerformer: staffPerformance[0] || null
      });

    } catch (error) {
      console.error('❌ [STAFF METRICS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // =============================================
  // REVENUE ANALYTICS
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/metrics/revenue-breakdown`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month

      console.log(`💰 [REVENUE BREAKDOWN] Vendor: ${vendorId}`);

      const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
      
      const revenueByService = new Map();
      const revenueByStaff = new Map();
      const revenueByDate = new Map();
      
      let totalRevenue = 0;
      let platformFees = 0;
      const COMMISSION_RATE = 0.15;

      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking || booking.status !== 'completed') continue;

        const revenue = booking.price || 0;
        totalRevenue += revenue;
        platformFees += revenue * COMMISSION_RATE;

        // By service
        const serviceKey = booking.serviceName || 'Unknown';
        revenueByService.set(serviceKey, (revenueByService.get(serviceKey) || 0) + revenue);

        // By staff
        const staffKey = booking.doctorName || booking.staffName || 'Unassigned';
        revenueByStaff.set(staffKey, (revenueByStaff.get(staffKey) || 0) + revenue);

        // By date
        const date = booking.bookingDate || booking.createdAt?.split('T')[0];
        if (date) {
          revenueByDate.set(date, (revenueByDate.get(date) || 0) + revenue);
        }
      }

      // Convert to arrays
      const byService = Array.from(revenueByService.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      const byStaff = Array.from(revenueByStaff.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      const byDate = Array.from(revenueByDate.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return sendSuccess(c, {
        summary: {
          totalRevenue,
          platformFees: Number(platformFees.toFixed(2)),
          netRevenue: Number((totalRevenue - platformFees).toFixed(2)),
          commissionRate: COMMISSION_RATE
        },
        breakdown: {
          byService,
          byStaff,
          byDate
        }
      });

    } catch (error) {
      console.error('❌ [REVENUE BREAKDOWN] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // =============================================
  // GROWTH TRENDS
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/metrics/growth`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`📈 [GROWTH METRICS] Vendor: ${vendorId}`);

      // Calculate current month and previous month
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
      
      let currentMonthBookings = 0;
      let previousMonthBookings = 0;
      let currentMonthRevenue = 0;
      let previousMonthRevenue = 0;
      let currentMonthCustomers = new Set();
      let previousMonthCustomers = new Set();

      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) continue;

        const bookingDate = new Date(booking.bookingDate || booking.createdAt);
        const revenue = booking.status === 'completed' ? (booking.price || 0) : 0;

        if (bookingDate >= currentMonth) {
          currentMonthBookings++;
          currentMonthRevenue += revenue;
          if (booking.customerId) currentMonthCustomers.add(booking.customerId);
        } else if (bookingDate >= previousMonth && bookingDate < currentMonth) {
          previousMonthBookings++;
          previousMonthRevenue += revenue;
          if (booking.customerId) previousMonthCustomers.add(booking.customerId);
        }
      }

      // Calculate growth rates
      const bookingGrowth = previousMonthBookings > 0
        ? ((currentMonthBookings - previousMonthBookings) / previousMonthBookings * 100)
        : 0;

      const revenueGrowth = previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100)
        : 0;

      const customerGrowth = previousMonthCustomers.size > 0
        ? ((currentMonthCustomers.size - previousMonthCustomers.size) / previousMonthCustomers.size * 100)
        : 0;

      return sendSuccess(c, {
        currentMonth: {
          bookings: currentMonthBookings,
          revenue: currentMonthRevenue,
          customers: currentMonthCustomers.size
        },
        previousMonth: {
          bookings: previousMonthBookings,
          revenue: previousMonthRevenue,
          customers: previousMonthCustomers.size
        },
        growth: {
          bookings: Number(bookingGrowth.toFixed(1)),
          revenue: Number(revenueGrowth.toFixed(1)),
          customers: Number(customerGrowth.toFixed(1))
        }
      });

    } catch (error) {
      console.error('❌ [GROWTH METRICS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Vendor metrics enhancement registered');
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function calculateServiceMetrics(vendorId: string) {
  const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
  
  let totalServices = 0;
  let activeServices = 0;
  let inactiveServices = 0;
  const servicesByCategory = new Map();

  for (const serviceId of serviceIds) {
    const service = await kv.get(`service:${serviceId}`);
    if (!service) continue;

    totalServices++;
    
    if (service.isActive !== false) {
      activeServices++;
    } else {
      inactiveServices++;
    }

    // Count by category
    const category = service.category || 'Uncategorized';
    servicesByCategory.set(category, (servicesByCategory.get(category) || 0) + 1);
  }

  return {
    total: totalServices,
    active: activeServices,
    inactive: inactiveServices,
    byCategory: Object.fromEntries(servicesByCategory)
  };
}

async function calculateStaffMetrics(vendorId: string) {
  const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
  
  let totalStaff = 0;
  let activeStaff = 0;
  const staffByRole = new Map();

  for (const staffId of staffIds) {
    if (typeof staffId !== 'string' || staffId.startsWith('staffsvc_')) continue;

    const staff = await kv.get(`staff:${staffId}`);
    if (!staff) continue;

    totalStaff++;
    
    if (staff.isActive !== false) {
      activeStaff++;
      
      const role = staff.role || 'Other';
      staffByRole.set(role, (staffByRole.get(role) || 0) + 1);
    }
  }

  return {
    total: totalStaff,
    active: activeStaff,
    inactive: totalStaff - activeStaff,
    byRole: Object.fromEntries(staffByRole)
  };
}

async function calculateBookingMetrics(vendorId: string, startDate: Date) {
  const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
  
  let total = 0;
  let confirmed = 0;
  let completed = 0;
  let cancelled = 0;
  let inProgress = 0;
  let pending = 0;

  for (const bookingId of bookingIds) {
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) continue;

    const bookingDate = new Date(booking.bookingDate || booking.createdAt);
    if (bookingDate < startDate) continue;

    total++;

    switch (booking.status) {
      case 'confirmed': confirmed++; break;
      case 'completed': completed++; break;
      case 'cancelled': cancelled++; break;
      case 'in_progress': inProgress++; break;
      case 'pending': pending++; break;
    }
  }

  const completionRate = total > 0 ? (completed / total * 100) : 0;
  const cancellationRate = total > 0 ? (cancelled / total * 100) : 0;

  return {
    total,
    byStatus: {
      pending,
      confirmed,
      inProgress,
      completed,
      cancelled
    },
    metrics: {
      completionRate: Number(completionRate.toFixed(1)),
      cancellationRate: Number(cancellationRate.toFixed(1))
    }
  };
}

async function calculateRevenueMetrics(vendorId: string, startDate: Date) {
  const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
  
  let totalRevenue = 0;
  let completedRevenue = 0;
  let pendingRevenue = 0;

  for (const bookingId of bookingIds) {
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) continue;

    const bookingDate = new Date(booking.bookingDate || booking.createdAt);
    if (bookingDate < startDate) continue;

    const amount = booking.price || 0;
    totalRevenue += amount;

    if (booking.status === 'completed') {
      completedRevenue += amount;
    } else if (booking.status === 'confirmed' || booking.status === 'in_progress') {
      pendingRevenue += amount;
    }
  }

  const COMMISSION_RATE = 0.15;
  const platformFee = completedRevenue * COMMISSION_RATE;
  const netRevenue = completedRevenue - platformFee;

  return {
    total: totalRevenue,
    completed: completedRevenue,
    pending: pendingRevenue,
    platformFee: Number(platformFee.toFixed(2)),
    net: Number(netRevenue.toFixed(2)),
    commissionRate: COMMISSION_RATE
  };
}

async function calculatePackageMetrics(vendorId: string) {
  const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
  const enrollments = await kv.get(`vendor:${vendorId}:package_enrollments`) || [];
  
  let totalPackages = 0;
  let activePackages = 0;
  let totalEnrollments = 0;
  let activeEnrollments = 0;
  let completedEnrollments = 0;
  let packageRevenue = 0;

  for (const pkg of packages) {
    totalPackages++;
    if (pkg.isActive) activePackages++;
  }

  for (const enrollment of enrollments) {
    totalEnrollments++;
    
    if (enrollment.status === 'active') {
      activeEnrollments++;
    } else if (enrollment.status === 'completed') {
      completedEnrollments++;
    }

    if (enrollment.paymentStatus === 'paid') {
      packageRevenue += enrollment.totalPrice || 0;
    }
  }

  return {
    packages: {
      total: totalPackages,
      active: activePackages
    },
    enrollments: {
      total: totalEnrollments,
      active: activeEnrollments,
      completed: completedEnrollments
    },
    revenue: packageRevenue
  };
}

async function calculateCustomerMetrics(vendorId: string, startDate: Date) {
  const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
  
  const uniqueCustomers = new Set();
  const customerBookingCount = new Map();

  for (const bookingId of bookingIds) {
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) continue;

    const bookingDate = new Date(booking.bookingDate || booking.createdAt);
    if (bookingDate < startDate) continue;

    if (booking.customerId) {
      uniqueCustomers.add(booking.customerId);
      customerBookingCount.set(
        booking.customerId, 
        (customerBookingCount.get(booking.customerId) || 0) + 1
      );
    }
  }

  // Calculate repeat customers (2+ bookings)
  let repeatCustomers = 0;
  for (const count of customerBookingCount.values()) {
    if (count >= 2) repeatCustomers++;
  }

  const repeatRate = uniqueCustomers.size > 0 
    ? (repeatCustomers / uniqueCustomers.size * 100) 
    : 0;

  return {
    total: uniqueCustomers.size,
    new: uniqueCustomers.size - repeatCustomers,
    repeat: repeatCustomers,
    repeatRate: Number(repeatRate.toFixed(1))
  };
}

async function calculatePerformanceMetrics(vendorId: string, startDate: Date) {
  const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
  const reviews = await kv.get(`vendor:${vendorId}:reviews`) || [];
  
  // Calculate average rating
  let avgRating = 0;
  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
    avgRating = Number((totalRating / reviews.length).toFixed(1));
  }

  // Calculate response time (time from booking to confirmation)
  let totalResponseTime = 0;
  let responseCount = 0;

  for (const bookingId of bookingIds) {
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking || !booking.createdAt) continue;

    const bookingDate = new Date(booking.bookingDate || booking.createdAt);
    if (bookingDate < startDate) continue;

    // Find confirmation time from status history
    if (booking.statusHistory) {
      const confirmEvent = booking.statusHistory.find((h: any) => h.status === 'confirmed');
      if (confirmEvent) {
        const created = new Date(booking.createdAt).getTime();
        const confirmed = new Date(confirmEvent.timestamp).getTime();
        totalResponseTime += (confirmed - created);
        responseCount++;
      }
    }
  }

  const avgResponseTime = responseCount > 0 
    ? Math.round(totalResponseTime / responseCount / 1000 / 60) // Convert to minutes
    : 0;

  return {
    avgRating,
    totalReviews: reviews.length,
    avgResponseTime: avgResponseTime, // in minutes
    responseCount
  };
}
