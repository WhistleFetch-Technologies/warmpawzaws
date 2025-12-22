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
import { getDbClient } from "../../lib/db.ts";

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
      
      // ✅ SQL: Get vendor profile
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        console.log(`⚠️ Vendor not found: ${vendorId}, returning default dashboard`);
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
      
      // ✅ SQL: Get all vendor bookings
      const bookings = await getBookingsRepository().findByVendor(vendorId);
      
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
        const bookingDate = new Date(booking.booking_date);
        
        // Filter by timeframe
        if (bookingDate >= startDate) {
          if (booking.status === 'confirmed' || booking.status === 'pending') {
            stats.appointments++;
          }
          
          if (booking.status === 'completed') {
            stats.completedServices++;
            stats.consultations++;
            stats.earnings += booking.total_amount || 0;
          }
          
          if (booking.status === 'in_progress' || booking.status === 'confirmed') {
            stats.pendingEarnings += booking.total_amount || 0;
          }
        }
      }
      
      // ✅ SQL: Get vendor rating from reviews
      const reviews = await getReviewsRepository().findByVendor(vendorId);
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
          fullName: vendor.owner_name,
          businessName: vendor.business_name,
          vendorType: vendor.category || 'service_provider',
          serviceStyle: 'both', // TODO: Add to vendor schema
          address: vendor.address,
          phone: vendor.phone,
          email: vendor.email,
          isActive: vendor.is_active
        },
        stats,
        timeframe 
      });
    } catch (error) {
      console.error('Error fetching vendor dashboard:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get today's schedule for vendor
   * GET /make-server-3dd53475/vendor/schedule/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/schedule/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date') || new Date().toISOString().split('T')[0];
      
      console.log(`📅 [SCHEDULE] Vendor: ${vendorId}, Date: ${date}`);
      
      // ✅ SQL: Get bookings for vendor on specific date
      const bookings = await getBookingsRepository().findByVendor(vendorId, {
        date,
      });
      
      const schedule = [];
      
      for (const booking of bookings) {
        // Filter by date and active statuses
        if (booking.booking_date === date && 
            (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress')) {
          
          // ✅ SQL: Get customer details
          const customer = await getCustomersRepository().findById(booking.customer_id);
          
          schedule.push({
            id: booking.id,
            bookingId: booking.id,
            time: booking.booking_time,
            duration: 60, // TODO: Add duration to booking schema
            petName: null, // TODO: Add pet info to booking schema
            petBreed: null,
            customerName: customer?.full_name || 'Customer',
            customerPhone: customer?.phone,
            serviceName: booking.service_type,
            serviceType: booking.service_type,
            status: booking.status,
            price: booking.total_amount,
            address: booking.address,
            specialInstructions: booking.notes
          });
        }
      }
      
      // Sort by time
      schedule.sort((a, b) => {
        const timeA = a.time.split(':').map(Number);
        const timeB = b.time.split(':').map(Number);
        return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
      });
      
      return sendSuccess(c, { schedule, date, total: schedule.length });
    } catch (error) {
      console.error('Error fetching vendor schedule:', error);
      return sendError(c, error, 500);
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
      
      // ✅ SQL: Get all commissions for vendor
      const commissions = await getCommissionsRepository().findByVendor(vendorId);
      
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
      
      // ✅ SQL: Get payouts for vendor
      const payouts = await getPayoutsRepository().findByVendor(vendorId);
      
      return sendSuccess(c, { payouts, total: payouts.length });
    } catch (error) {
      console.error('Error fetching vendor payouts:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Vendor dashboard endpoints registered (SQL-only)');
}

