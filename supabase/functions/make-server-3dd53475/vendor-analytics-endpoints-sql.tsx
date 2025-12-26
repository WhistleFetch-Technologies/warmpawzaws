/**
 * ============================================================================
 * VENDOR ANALYTICS & REPORTING ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Comprehensive analytics for Vets, Groomers, and Trainers
 * Provides performance metrics, earnings, and business insights
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `VendorsRepository`, `BookingsRepository`, `ReviewsRepository`, `StaffRepository`
 * - Uses `vendors`, `bookings`, `reviews`, `staff` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (10 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const bookingsRepo = getBookingsRepository();
const reviewsRepo = getReviewsRepository();
const staffRepo = getStaffRepository();

/**
 * GET /vendor/:vendorId/analytics
 * Get comprehensive analytics for vendor
 */
app.get("/make-server-3dd53475/vendor/:vendorId/analytics", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    const period = c.req.query("period") || "month";
    
    // ✅ SQL: Get vendor
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
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
    
    // ✅ SQL: Get bookings for vendor
    const { data: bookings } = await db
      .from('bookings')
      .select('*')
      .eq('vendor_id', vendorId)
      .gte('created_at', periodStart.toISOString());
    
    const periodBookings = period === 'all' ? bookings || [] : (bookings || []).filter((b: any) => 
      new Date(b.created_at) >= periodStart
    );
    
    // Calculate status breakdown
    const completed = periodBookings.filter((b: any) => b.status === 'completed');
    const cancelled = periodBookings.filter((b: any) => b.status === 'cancelled');
    const pending = periodBookings.filter((b: any) => b.status === 'pending');
    const confirmed = periodBookings.filter((b: any) => b.status === 'confirmed');
    const inProgress = periodBookings.filter((b: any) => ['in_progress', 'customer_arrived'].includes(b.status));
    
    // Calculate earnings
    const totalEarnings = completed.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount || 0), 0);
    const pendingEarnings = confirmed.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount || 0), 0);
    
    // ✅ SQL: Get reviews
    const { data: reviews } = await db
      .from('reviews')
      .select('*')
      .eq('vendor_id', vendorId)
      .gte('created_at', periodStart.toISOString());
    
    const avgRating = reviews && reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : 0;
    
    // ✅ SQL: Get staff count
    const { data: staff } = await db
      .from('staff')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('is_active', true);
    
    const staffCount = staff?.length || 0;
    
    // Calculate customer breakdown
    const uniqueCustomers = new Set(periodBookings.map((b: any) => b.customer_id));
    
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
        avgBookingValue: completed.length > 0 ? (totalEarnings / completed.length).toFixed(0) : 0,
        completionRate: periodBookings.length > 0 
          ? ((completed.length / periodBookings.length) * 100).toFixed(1)
          : 0,
        cancellationRate: periodBookings.length > 0
          ? ((cancelled.length / periodBookings.length) * 100).toFixed(1)
          : 0,
        avgRating,
        reviewCount: reviews?.length || 0,
        staffCount,
        uniqueCustomers: uniqueCustomers.size
      }
    };
    
    return c.json({ analytics });
  } catch (error) {
    console.error("Error fetching vendor analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

console.log('✅ Vendor Analytics Endpoints (SQL-only) registered');

export default app;

