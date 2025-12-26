/**
 * ✅ VENDOR DASHBOARD METRICS ENHANCEMENT - SQL-ONLY VERSION
 * Production-ready comprehensive vendor analytics
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 29 → 0
 * 
 * Features:
 * - Real-time service counting (totalServices, activeServices)
 * - Staff utilization metrics
 * - Package enrollment tracking
 * - Revenue analytics by service
 * - Customer acquisition metrics
 * - Conversion rate tracking
 * - Growth trends
 */

import { Hono } from "npm:hono";
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getPackagesRepository } from '../../lib/repositories/packages.ts';
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerVendorMetricsEnhancementSQL(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const client = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const servicesRepo = getServicesRepository();
  const bookingsRepo = getBookingsRepository();
  const staffRepo = getStaffRepository();
  const reviewsRepo = getReviewsRepository();
  const packagesRepo = getPackagesRepository();

  // =============================================
  // ENHANCED DASHBOARD OVERVIEW
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/metrics/overview`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'month';

      console.log(`📊 [VENDOR METRICS] Fetching overview for: ${vendorId}, timeframe: ${timeframe}`);

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
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

      // Calculate all metrics
      const servicesMetrics = await calculateServiceMetrics(vendorId);
      const staffMetrics = await calculateStaffMetrics(vendorId);
      const bookingMetrics = await calculateBookingMetrics(vendorId, startDate);
      const revenueMetrics = await calculateRevenueMetrics(vendorId, startDate);
      const packageMetrics = await calculatePackageMetrics(vendorId);
      const customerMetrics = await calculateCustomerMetrics(vendorId, startDate);
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

      // ✅ SQL: Get all services for vendor
      const services = await servicesRepo.findByVendor(vendorId);
      
      // ✅ SQL: Get all bookings for vendor
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
      const servicePerformance = [];

      for (const service of services) {
        // Filter bookings for this service
        const serviceBookings = bookings.filter(b => b.service_id === service.id);

        // Calculate metrics
        const totalBookings = serviceBookings.length;
        const completedBookings = serviceBookings.filter(b => b.status === 'completed').length;
        const totalRevenue = serviceBookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.total_amount || 0), 0);
        
        // ✅ SQL: Get average rating for this service
        const { data: serviceReviews } = await client
          .from('reviews')
          .select('rating')
          .eq('service_id', service.id);
        
        const avgRating = serviceReviews && serviceReviews.length > 0
          ? serviceReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / serviceReviews.length
          : 0;
        
        const conversionRate = totalBookings > 0 ? (completedBookings / totalBookings * 100) : 0;

        servicePerformance.push({
          serviceId: service.id,
          serviceName: service.name,
          category: service.category,
          price: service.price,
          isActive: service.is_active,
          metrics: {
            totalBookings,
            completedBookings,
            totalRevenue,
            avgRevenue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
            avgRating: Number(avgRating.toFixed(1)),
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

      // ✅ SQL: Get all staff for vendor
      const staffList = await staffRepo.findByVendorId(vendorId);
      
      // ✅ SQL: Get all bookings for vendor
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
      const staffPerformance = [];

      for (const staff of staffList) {
        // Filter bookings assigned to this staff
        const staffBookings = bookings.filter(b => b.staff_id === staff.id);

        // ✅ SQL: Get staff services
        const { data: staffServices } = await client
          .from('staff_services')
          .select('service_id')
          .eq('staff_id', staff.id)
          .eq('is_enabled', true);

        // Calculate metrics
        const totalBookings = staffBookings.length;
        const completedBookings = staffBookings.filter(b => b.status === 'completed').length;
        const totalRevenue = staffBookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.total_amount || 0), 0);
        const utilization = totalBookings > 0 ? (completedBookings / totalBookings * 100) : 0;

        staffPerformance.push({
          staffId: staff.id,
          name: staff.fullName,
          role: staff.role,
          specialization: staff.specialization,
          metrics: {
            assignedServices: staffServices?.length || 0,
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
      const period = c.req.query('period') || 'month';

      console.log(`💰 [REVENUE BREAKDOWN] Vendor: ${vendorId}`);

      // ✅ SQL: Get all bookings for vendor
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
      const revenueByService = new Map();
      const revenueByStaff = new Map();
      const revenueByDate = new Map();
      
      let totalRevenue = 0;
      let platformFees = 0;
      const COMMISSION_RATE = 0.15;

      for (const booking of bookings) {
        if (booking.status !== 'completed') continue;

        const revenue = booking.total_amount || 0;
        totalRevenue += revenue;
        platformFees += revenue * COMMISSION_RATE;

        // By service
        const service = await servicesRepo.findById(booking.service_id);
        const serviceKey = service?.name || 'Unknown';
        revenueByService.set(serviceKey, (revenueByService.get(serviceKey) || 0) + revenue);

        // By staff
        let staffKey = 'Unassigned';
        if (booking.staff_id) {
          const staff = await staffRepo.findById(booking.staff_id);
          staffKey = staff?.fullName || 'Unassigned';
        }
        revenueByStaff.set(staffKey, (revenueByStaff.get(staffKey) || 0) + revenue);

        // By date
        const date = booking.booking_date || booking.created_at?.split('T')[0];
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

      // ✅ SQL: Get all bookings for vendor
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
      let currentMonthBookings = 0;
      let previousMonthBookings = 0;
      let currentMonthRevenue = 0;
      let previousMonthRevenue = 0;
      let currentMonthCustomers = new Set();
      let previousMonthCustomers = new Set();

      for (const booking of bookings) {
        const bookingDate = new Date(booking.booking_date || booking.created_at);
        const revenue = booking.status === 'completed' ? (booking.total_amount || 0) : 0;

        if (bookingDate >= currentMonth) {
          currentMonthBookings++;
          currentMonthRevenue += revenue;
          if (booking.customer_id) currentMonthCustomers.add(booking.customer_id);
        } else if (bookingDate >= previousMonth && bookingDate < currentMonth) {
          previousMonthBookings++;
          previousMonthRevenue += revenue;
          if (booking.customer_id) previousMonthCustomers.add(booking.customer_id);
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

  console.log('✅ Vendor metrics enhancement (SQL-only) registered');
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function calculateServiceMetrics(vendorId: string) {
  const servicesRepo = getServicesRepository();
  const services = await servicesRepo.findByVendor(vendorId);
  
  let totalServices = 0;
  let activeServices = 0;
  let inactiveServices = 0;
  const servicesByCategory = new Map();

  for (const service of services) {
    totalServices++;
    
    if (service.is_active !== false) {
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
  const staffRepo = getStaffRepository();
  const staffList = await staffRepo.findByVendorId(vendorId);
  
  let totalStaff = 0;
  let activeStaff = 0;
  const staffByRole = new Map();

  for (const staff of staffList) {
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
  const bookingsRepo = getBookingsRepository();
  const bookings = await bookingsRepo.findByVendor(vendorId);
  
  let total = 0;
  let confirmed = 0;
  let completed = 0;
  let cancelled = 0;
  let inProgress = 0;
  let pending = 0;

  for (const booking of bookings) {
    const bookingDate = new Date(booking.booking_date || booking.created_at);
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
  const bookingsRepo = getBookingsRepository();
  const bookings = await bookingsRepo.findByVendor(vendorId);
  
  let totalRevenue = 0;
  let completedRevenue = 0;
  let pendingRevenue = 0;

  for (const booking of bookings) {
    const bookingDate = new Date(booking.booking_date || booking.created_at);
    if (bookingDate < startDate) continue;

    const amount = booking.total_amount || 0;
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
  const packagesRepo = getPackagesRepository();
  const packages = await packagesRepo.getAllPackages({ vendorId, isActive: true });
  const enrollments = await packagesRepo.getEnrollments({ vendorId });
  
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

    // Note: Package revenue would need to be calculated from payments/bookings
    // For now, we'll set it to 0 or calculate from package bookings
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
  const bookingsRepo = getBookingsRepository();
  const bookings = await bookingsRepo.findByVendor(vendorId);
  
  const uniqueCustomers = new Set();
  const customerBookingCount = new Map();

  for (const booking of bookings) {
    const bookingDate = new Date(booking.booking_date || booking.created_at);
    if (bookingDate < startDate) continue;

    if (booking.customer_id) {
      uniqueCustomers.add(booking.customer_id);
      customerBookingCount.set(
        booking.customer_id, 
        (customerBookingCount.get(booking.customer_id) || 0) + 1
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
  const bookingsRepo = getBookingsRepository();
  const reviewsRepo = getReviewsRepository();
  const bookings = await bookingsRepo.findByVendor(vendorId);
  const reviews = await reviewsRepo.findByVendor(vendorId);
  
  // Calculate average rating
  let avgRating = 0;
  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    avgRating = Number((totalRating / reviews.length).toFixed(1));
  }

  // Calculate response time (time from booking to confirmation)
  let totalResponseTime = 0;
  let responseCount = 0;

  for (const booking of bookings) {
    if (!booking.created_at) continue;

    const bookingDate = new Date(booking.booking_date || booking.created_at);
    if (bookingDate < startDate) continue;

    // For SQL-based bookings, we can check updated_at vs created_at for status changes
    // This is a simplified version - in production, you might track status history in a separate table
    if (booking.status === 'confirmed' && booking.updated_at) {
      const created = new Date(booking.created_at).getTime();
      const confirmed = new Date(booking.updated_at).getTime();
      totalResponseTime += (confirmed - created);
      responseCount++;
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

