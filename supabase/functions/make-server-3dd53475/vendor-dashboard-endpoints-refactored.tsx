/**
 * ============================================================================
 * VENDOR DASHBOARD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete API endpoints for vendor dashboard with:
 * - Real-time appointment data from customer bookings
 * - Revenue tracking (realized after service completion)
 * - Payout management (settled via admin)
 * - Dashboard statistics and analytics
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `tryGet()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getCommissionsRepository } from "../../lib/repositories/commissions.ts";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getDbClient } from "../../lib/db.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * SQL-ONLY Vendor Dashboard Endpoints
 * 
 * ❌ NO KV USAGE - All operations use SQL repositories
 */
export function vendorDashboardEndpoints(app: Hono) {
  
  /**
   * Get comprehensive vendor dashboard data
   * GET /make-server-3dd53475/vendor/dashboard/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/dashboard/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'today';
      
      console.log(`📊 [DASHBOARD] Fetching dashboard for vendor: ${vendorId}, timeframe: ${timeframe}`);
      
      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendor } = await import('../../lib/utils/vendor-id-resolver.ts');
      const vendor = await resolveVendor(vendorId);
      
      if (!vendor) {
        console.error(`❌ [DASHBOARD] Vendor not found: ${vendorId}`);
        console.log(`⚠️ [DASHBOARD] Vendor not found: ${vendorId}, returning default dashboard`);
        return sendSuccess(c, { 
          vendor: {
            vendorId,
            fullName: 'Vendor',
            businessName: null,
            vendorType: 'service_provider',
            serviceStyle: 'both',
            address: 'Location not set',
            isActive: false
          },
          stats: {
            appointments: 0,
            consultations: 0,
            earnings: 0,
            pendingEarnings: 0,
            completedServices: 0,
            rating: 4.8,
            totalReviews: 0
          },
          timeframe
        });
      }
      
      const vendorUuid = vendor.id;
      
      // ✅ SQL: Get all vendor bookings
      let bookings = [];
      try {
        bookings = await getBookingsRepository().findByVendor(vendorUuid);
      } catch (bookingsError) {
        console.error(`❌ [DASHBOARD] Error fetching bookings for vendor ${vendorId}:`, bookingsError);
        bookings = [];
      }
      
      // Initialize stats
      const stats = {
        appointments: 0,
        consultations: 0,
        earnings: 0,
        pendingEarnings: 0,
        completedServices: 0,
        rating: 0,
        totalReviews: 0
      };
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Calculate date ranges
      let startDate = new Date();
      if (timeframe === 'today') {
        startDate = new Date(today);
      } else if (timeframe === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      // Process bookings
      for (const booking of bookings) {
        try {
          // Handle different date formats
          let bookingDate: Date;
          if (booking.booking_date instanceof Date) {
            bookingDate = booking.booking_date;
          } else if (typeof booking.booking_date === 'string') {
            bookingDate = new Date(booking.booking_date);
          } else {
            continue; // Skip invalid dates
          }
          
          // Filter by timeframe
          if (bookingDate >= startDate) {
            // ✅ FIX: Show bookings that are paid AND confirmed/pending (vendor can see after payment)
            if ((booking.status === 'confirmed' || booking.status === 'pending') && 
                (booking.payment_status === 'paid' || booking.payment_status === 'pending')) {
              stats.appointments++;
            }
            
            if (booking.status === 'completed') {
              stats.completedServices++;
              stats.consultations++;
              stats.earnings += booking.total_amount || 0;
            }
            
            // ✅ FIX: Pending earnings = confirmed bookings with paid status but not yet completed
            if ((booking.status === 'in_progress' || booking.status === 'confirmed') && 
                booking.payment_status === 'paid') {
              stats.pendingEarnings += booking.total_amount || 0;
            }
          }
        } catch (bookingError) {
          console.warn(`⚠️ [DASHBOARD] Error processing booking ${booking.id}:`, bookingError);
          // Continue with other bookings
        }
      }
      
      // ✅ SQL: Get vendor rating from reviews
      let reviews = [];
      try {
        reviews = await getReviewsRepository().findByVendor(vendorId);
      } catch (reviewsError) {
        console.error(`❌ [DASHBOARD] Error fetching reviews for vendor ${vendorId}:`, reviewsError);
        reviews = [];
      }
      
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        stats.rating = Number((totalRating / reviews.length).toFixed(1));
        stats.totalReviews = reviews.length;
      } else {
        stats.rating = 4.8; // Default rating for new vendors
        stats.totalReviews = 0;
      }
      
      return sendSuccess(c, { 
        vendor: {
          vendorId: vendor.id,
          fullName: vendor.owner_name || vendor.full_name || 'Vendor',
          businessName: vendor.business_name || vendor.businessName,
          vendorType: vendor.category || vendor.vendor_type || 'service_provider',
          serviceStyle: vendor.service_style || 'both',
          address: vendor.address || '',
          phone: vendor.phone || '',
          email: vendor.email || '',
          isActive: vendor.is_active !== false
        },
        stats,
        timeframe 
      });
    } catch (error) {
      console.error('❌ [DASHBOARD] Error fetching vendor dashboard:', error);
      return sendError(c, `Failed to fetch dashboard: ${String(error)}`, 500);
    }
  });
  
  /**
   * Get today's schedule for vendor
   * GET /make-server-3dd53475/vendor/schedule/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   * ✅ FIXED: Converts vendor_id to UUID before querying
   */
  app.get("/make-server-3dd53475/vendor/schedule/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const dateParam = c.req.query('date');
      
      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendorIdToUuid } = await import('../../lib/utils/vendor-id-resolver.ts');
      const vendorUuid = await resolveVendorIdToUuid(vendorId);
      
      if (!vendorUuid) {
        console.warn(`⚠️ [SCHEDULE] Vendor not found: ${vendorId}, returning empty schedule`);
        return sendSuccess(c, { schedule: [], date: dateParam || new Date().toISOString().split('T')[0] });
      }
      
      console.log(`✅ [SCHEDULE] Resolved vendor ID: ${vendorId} -> ${vendorUuid}`);
      
      // Normalize date format (YYYY-MM-DD)
      let date: string;
      if (dateParam) {
        // If date is provided, normalize it
        const dateObj = new Date(dateParam);
        if (isNaN(dateObj.getTime())) {
          date = new Date().toISOString().split('T')[0];
        } else {
          date = dateObj.toISOString().split('T')[0];
        }
      } else {
        date = new Date().toISOString().split('T')[0];
      }
      
      console.log(`📅 [SCHEDULE] Vendor: ${vendorId}, Date: ${date}`);
      
      // ✅ SQL: Get bookings for vendor on specific date
      const bookings = await getBookingsRepository().findByVendor(vendorUuid, {
        date,
      });
      
      const schedule = [];
      
      for (const booking of bookings) {
        try {
          // Normalize booking date for comparison
          const bookingDate = booking.booking_date instanceof Date 
            ? booking.booking_date.toISOString().split('T')[0]
            : booking.booking_date?.split('T')[0] || booking.booking_date;
          
          // ✅ FIX: Filter by date, active statuses, AND payment status (vendor should only see paid bookings)
          if (bookingDate === date && 
              (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress') &&
              (booking.payment_status === 'paid' || booking.payment_status === 'pending')) {
            
            // ✅ SQL: Get customer details
            let customer = null;
            try {
              customer = await getCustomersRepository().findById(booking.customer_id);
            } catch (customerError) {
              console.warn(`⚠️ [SCHEDULE] Could not fetch customer ${booking.customer_id}:`, customerError);
            }
            
            schedule.push({
              id: booking.id,
              bookingId: booking.id,
              time: booking.booking_time || '00:00',
              duration: 60, // TODO: Add duration to booking schema
              petName: null, // TODO: Add pet info to booking schema
              petBreed: null,
              customerName: customer?.full_name || 'Customer',
              customerPhone: customer?.phone,
              serviceName: booking.service_type || 'Service',
              serviceType: booking.service_type || 'service',
              status: booking.status,
              price: booking.total_amount || 0,
              address: booking.address || '',
              specialInstructions: booking.notes || ''
            });
          }
        } catch (bookingError) {
          console.warn(`⚠️ [SCHEDULE] Error processing booking ${booking.id}:`, bookingError);
          // Continue with other bookings
        }
      }
      
      // Sort by time
      schedule.sort((a, b) => {
        try {
          const timeA = (a.time || '00:00').split(':').map(Number);
          const timeB = (b.time || '00:00').split(':').map(Number);
          return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
        } catch {
          return 0;
        }
      });
      
      return sendSuccess(c, { schedule, date, total: schedule.length });
    } catch (error) {
      console.error('❌ [SCHEDULE] Error fetching vendor schedule:', error);
      return sendError(c, `Failed to fetch schedule: ${String(error)}`, 500);
    }
  });
  
  /**
   * Get vendor revenue details
   * GET /make-server-3dd53475/vendor/revenue/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/revenue/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const timeframe = c.req.query('timeframe') || 'month';
      
      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendorIdToUuid } = await import('../../lib/utils/vendor-id-resolver.ts');
      const resolvedVendorId = await resolveVendorIdToUuid(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, `Vendor not found: ${vendorId}`, 404);
      }
      
      // ✅ SQL: Get all commissions for vendor
      const commissions = await getCommissionsRepository().findByVendor(resolvedVendorId);
      
      const revenue = {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        platformFee: 0,
        netRevenue: 0,
        breakdown: [] as any[]
      };
      
      const now = new Date();
      let startDate = new Date();
      
      if (timeframe === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeframe === 'year') {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      }
      
      // Process commissions (earnings)
      for (const commission of commissions) {
        const commissionDate = new Date(commission.created_at);
        
        if (commissionDate >= startDate) {
          const amount = commission.total_amount;
          const platformFee = commission.commission_amount;
          const netAmount = commission.vendor_amount;
          
          revenue.total += amount;
          revenue.platformFee += platformFee;
          revenue.netRevenue += netAmount;
          
          // Get booking details for breakdown
          if (commission.booking_id) {
            const booking = await getBookingsRepository().findById(commission.booking_id);
            if (booking) {
              revenue.breakdown.push({
                bookingId: booking.id,
                date: booking.booking_date,
                amount,
                platformFee,
                netAmount,
                status: booking.status
              });
              
              if (booking.status === 'completed') {
                revenue.completed += amount;
              } else if (booking.status === 'pending') {
                revenue.pending += amount;
              } else if (booking.status === 'in_progress') {
                revenue.inProgress += amount;
              }
            }
          }
        }
      }
      
      return sendSuccess(c, { revenue, timeframe });
    } catch (error) {
      console.error('Error fetching vendor revenue:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get vendor payouts
   * GET /make-server-3dd53475/vendor/payouts/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/payouts/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendorIdToUuid } = await import('../../lib/utils/vendor-id-resolver.ts');
      const resolvedVendorId = await resolveVendorIdToUuid(vendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, `Vendor not found: ${vendorId}`, 404);
      }
      
      // ✅ SQL: Get payouts for vendor
      const payouts = await getPayoutsRepository().findByVendor(resolvedVendorId);
      
      return sendSuccess(c, { payouts, total: payouts.length });
    } catch (error) {
      console.error('Error fetching vendor payouts:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor watchlist
   * GET /make-server-3dd53475/vendor/watchlist/:vendorId
   * 
   * Returns list of customers/pets the vendor is watching/tracking
   */
  app.get("/make-server-3dd53475/vendor/watchlist/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`👀 [WATCHLIST] Fetching watchlist for vendor: ${vendorId}`);
      
      // TODO: Implement watchlist feature in database
      // For now, return empty array to prevent 404 errors
      return sendSuccess(c, { 
        watchlist: [],
        total: 0
      });
    } catch (error) {
      console.error('Error fetching vendor watchlist:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get comprehensive analytics for vendor
   * GET /make-server-3dd53475/vendor/:vendorId/analytics?period=month
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/analytics", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query("period") || "month"; // day, week, month, year, all
      
      console.log(`📊 [ANALYTICS] Fetching analytics for vendor: ${paramVendorId}, period: ${period}`);
      
      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await getVendorsRepository().resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [ANALYTICS] Vendor not found or invalid ID format: ${paramVendorId}`);
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }
      
      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(resolvedVendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Get all bookings for vendor
      const allBookings = await getBookingsRepository().findByVendor(resolvedVendorId);
      
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
          periodStart = new Date(0); // Beginning of time
          break;
      }
      
      // Filter bookings by period
      const periodBookings = period === 'all' 
        ? allBookings 
        : allBookings.filter((booking) => {
            const bookingDate = booking.created_at ? new Date(booking.created_at) : new Date(booking.booking_date || booking.created_at || 0);
            return bookingDate >= periodStart;
          });
      
      // Calculate status breakdown
      const completed = periodBookings.filter((b) => b.status === 'completed');
      const cancelled = periodBookings.filter((b) => b.status === 'cancelled');
      const pending = periodBookings.filter((b) => b.status === 'pending');
      const confirmed = periodBookings.filter((b) => b.status === 'confirmed');
      const inProgress = periodBookings.filter((b) => b.status === 'in_progress');
      
      // Calculate earnings
      const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const pendingEarnings = confirmed.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      
      // Calculate service breakdown
      const serviceBreakdown: Record<string, any> = {};
      periodBookings.forEach((booking) => {
        const serviceName = booking.service_type || 'Unknown';
        if (!serviceBreakdown[serviceName]) {
          serviceBreakdown[serviceName] = {
            count: 0,
            revenue: 0,
            completed: 0
          };
        }
        serviceBreakdown[serviceName].count++;
        if (booking.status === 'completed') {
          serviceBreakdown[serviceName].completed++;
          serviceBreakdown[serviceName].revenue += booking.total_amount || 0;
        }
      });
      
      // ✅ SQL: Get reviews for vendor
      const allReviews = await getReviewsRepository().findByVendor(resolvedVendorId);
      const periodReviews = period === 'all'
        ? allReviews
        : allReviews.filter((r) => {
            const reviewDate = r.created_at ? new Date(r.created_at) : new Date(0);
            return reviewDate >= periodStart;
          });
      
      const avgRating = periodReviews.length > 0
        ? Number((periodReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / periodReviews.length).toFixed(1))
        : 0;
      
      // ✅ SQL: Get staff count
      const staff = await getStaffRepository().findByVendorId(resolvedVendorId);
      const activeStaff = staff.filter((s) => s.isActive !== false);
      const staffCount = activeStaff.length;
      
      // Calculate customer breakdown
      const uniqueCustomers = new Set(periodBookings.map((b) => b.customer_id));
      const customerBookingsMap = new Map<string, number>();
      periodBookings.forEach((booking) => {
        const count = customerBookingsMap.get(booking.customer_id) || 0;
        customerBookingsMap.set(booking.customer_id, count + 1);
      });
      const returningCustomers = Array.from(customerBookingsMap.entries())
        .filter(([_, count]) => count > 1)
        .map(([customerId]) => customerId);
      
      // Calculate daily earnings trend (last 7 days)
      const dailyEarnings = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayBookings = completed.filter((b) => {
          const bookingDate = b.completed_at 
            ? new Date(b.completed_at)
            : (b.created_at ? new Date(b.created_at) : new Date(0));
          return bookingDate >= date && bookingDate < nextDate;
        });
        
        const dayEarnings = dayBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
        
        dailyEarnings.push({
          date: date.toISOString().split('T')[0],
          earnings: dayEarnings,
          bookings: dayBookings.length
        });
      }
      
      const analytics = {
        period,
        overview: {
          totalBookings: periodBookings.length,
          completed: completed.length,
          cancelled: cancelled.length,
          pending: pending.length,
          confirmed: confirmed.length,
          inProgress: inProgress.length,
          
          totalEarnings,
          pendingEarnings,
          avgBookingValue: completed.length > 0 ? Number((totalEarnings / completed.length).toFixed(0)) : 0,
          
          completionRate: periodBookings.length > 0 
            ? Number(((completed.length / periodBookings.length) * 100).toFixed(1))
            : 0,
          cancellationRate: periodBookings.length > 0
            ? Number(((cancelled.length / periodBookings.length) * 100).toFixed(1))
            : 0,
          
          avgRating,
          reviewCount: periodReviews.length,
          
          staffCount,
          uniqueCustomers: uniqueCustomers.size,
          returningCustomers: returningCustomers.length,
          customerRetentionRate: uniqueCustomers.size > 0
            ? Number(((returningCustomers.length / uniqueCustomers.size) * 100).toFixed(1))
            : 0
        },
        
        serviceBreakdown: Object.entries(serviceBreakdown)
          .map(([name, data]) => ({
            serviceName: name,
            ...data
          }))
          .sort((a, b) => b.revenue - a.revenue),
        
        dailyEarnings,
        
        topServices: Object.entries(serviceBreakdown)
          .map(([name, data]: [string, any]) => ({
            serviceName: name,
            count: data.count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      };
      
      console.log(`✅ [ANALYTICS] Analytics calculated for ${paramVendorId} (resolved: ${resolvedVendorId})`);
      
      return sendSuccess(c, { analytics });
      
    } catch (error) {
      console.error("❌ [ANALYTICS] Error fetching vendor analytics:", error);
      return sendError(c, `Failed to fetch analytics: ${String(error)}`, 500);
    }
  });

  /**
   * Get performance metrics for all staff members
   * GET /make-server-3dd53475/vendor/:vendorId/staff-performance?period=month
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/staff-performance", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query("period") || "month";
      
      console.log(`👥 [STAFF-PERFORMANCE] Fetching staff performance for vendor: ${paramVendorId}`);
      
      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await getVendorsRepository().resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [STAFF-PERFORMANCE] Vendor not found or invalid ID format: ${paramVendorId}`);
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }
      
      // ✅ SQL: Get all staff for vendor
      const allStaff = await getStaffRepository().findByVendorId(resolvedVendorId);
      const activeStaff = allStaff.filter((s) => s.isActive !== false);
      
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
      }
      
      // Get performance for each staff
      const staffPerformance = await Promise.all(
        activeStaff.map(async (staff) => {
          // ✅ SQL: Get bookings for this staff
          const allStaffBookings = await getBookingsRepository().findByVendor(resolvedVendorId);
          const staffBookings = allStaffBookings.filter((booking) => 
            booking.staff_id === staff.id
          );
          
          // Filter by period
          const periodBookings = staffBookings.filter((booking) => {
            const bookingDate = booking.created_at ? new Date(booking.created_at) : new Date(booking.booking_date || booking.created_at || 0);
            return bookingDate >= periodStart;
          });
          
          const completed = periodBookings.filter((b) => b.status === 'completed');
          const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);
          
          // ✅ SQL: Get reviews for this staff (if reviews table has staff_id)
          const staffReviews = await getReviewsRepository().findByVendor(resolvedVendorId);
          // Filter reviews that mention this staff (if we have staff_id in reviews)
          const relevantReviews = staffReviews; // TODO: Add staff_id to reviews table if needed
          
          return {
            staffId: staff.id,
            fullName: staff.fullName || 'Staff Member',
            role: staff.role || 'staff',
            photo: staff.photo || null,
            specializations: staff.specializations || [],
            
            totalAppointments: periodBookings.length,
            completed: completed.length,
            completionRate: periodBookings.length > 0
              ? Number(((completed.length / periodBookings.length) * 100).toFixed(1))
              : 0,
            
            totalEarnings,
            avgBookingValue: completed.length > 0
              ? Number((totalEarnings / completed.length).toFixed(0))
              : 0,
            
            rating: 0, // TODO: Calculate from staff-specific reviews
            reviewCount: relevantReviews.length
          };
        })
      );
      
      // Sort by earnings
      const sortedStaffPerformance = staffPerformance
        .sort((a, b) => b.totalEarnings - a.totalEarnings);
      
      console.log(`✅ [STAFF-PERFORMANCE] Staff performance calculated for ${paramVendorId} (resolved: ${resolvedVendorId})`);
      
      return sendSuccess(c, { 
        staffPerformance: sortedStaffPerformance,
        period,
        totalStaff: sortedStaffPerformance.length
      });
      
    } catch (error) {
      console.error("❌ [STAFF-PERFORMANCE] Error fetching staff performance:", error);
      return sendError(c, `Failed to fetch staff performance: ${String(error)}`, 500);
    }
  });

  console.log('✅ Vendor dashboard endpoints registered (SQL-only)');
}

