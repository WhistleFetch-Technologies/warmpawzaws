/**
 * Staff Authentication & Management Endpoints (SQL-ONLY)
 * ✅ MIGRATED TO SQL: All operations use SQL repositories (NO KV STORE)
 * Handles separate login for doctors/staff with unique mobile numbers
 * Supports multi-vendor-type staff (vets, groomers, trainers, clinic doctors)
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getDbClient } from "../../lib/db.ts";

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Add logging middleware for debugging
app.use('*', async (c, next) => {
  console.log(`[STAFF AUTH SQL] ${c.req.method} ${c.req.url}`);
  await next();
});

// ============================================================================
// STAFF AUTHENTICATION
// ============================================================================

/**
 * POST /staff/auth/check-phone
 * ✅ MIGRATED TO SQL: Now uses SQL-based staff repository
 * Check if staff phone exists and return their profile
 */
app.post("/make-server-3dd53475/staff/auth/check-phone", async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (!phone) {
      return c.json({ error: "Phone number is required" }, 400);
    }
    
    console.log(`🔍 [STAFF CHECK] Checking staff phone: ${phone} (SQL)`);
    
    // ✅ USE SQL-BASED STAFF REPOSITORY (NO KV STORE)
    const staffRepo = getStaffRepository();
    const staffProfile = await staffRepo.findByPhone(phone);
    
    if (staffProfile) {
      return c.json({
        exists: true,
        staff: {
          id: staffProfile.id,
          staffId: staffProfile.staffId,
          vendorId: staffProfile.vendorId,
          fullName: staffProfile.fullName,
          phone: staffProfile.phone,
          email: staffProfile.email,
          role: staffProfile.role,
          roleType: staffProfile.roleType,
          specializations: staffProfile.specializations,
          isActive: staffProfile.isActive,
          consultationFee: staffProfile.consultationFee,
          services: staffProfile.services || [],
          availability: staffProfile.availability,
          totalAppointments: staffProfile.totalAppointments || 0,
          completedAppointments: staffProfile.completedAppointments || 0,
          totalEarnings: staffProfile.totalEarnings || 0,
          rating: staffProfile.rating || 0,
          reviewCount: staffProfile.reviewCount || 0
        }
      });
    }
    
    console.log(`❌ [STAFF CHECK] Staff not found for phone: ${phone}`);
    return c.json({ exists: false });
    
  } catch (error) {
    console.error("Error checking staff phone:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /staff/auth/login
 * ✅ MIGRATED TO SQL: Now uses SQL-based staff repository
 * Staff login with phone number
 */
app.post("/make-server-3dd53475/staff/auth/login", async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (!phone) {
      return c.json({ error: "Phone number is required" }, 400);
    }
    
    console.log(`🔐 [STAFF LOGIN] Login attempt: ${phone} (SQL)`);
    
    // ✅ USE SQL-BASED STAFF REPOSITORY (NO KV STORE)
    const staffRepo = getStaffRepository();
    const staffProfile = await staffRepo.findByPhone(phone);
    
    if (!staffProfile) {
      console.log(`❌ [STAFF LOGIN] Staff not found for phone: ${phone}`);
      return c.json({ error: "Staff not found or inactive" }, 404);
    }
    
    // Check if staff is active
    if (!staffProfile.isActive) {
      console.log(`❌ [STAFF LOGIN] Staff is inactive: ${staffProfile.id}`);
      return c.json({ error: "Staff account is inactive" }, 403);
    }
    
    // Update last login
    await staffRepo.updateLastLogin(staffProfile.id);
    
    console.log(`✅ [STAFF LOGIN] Login successful:`, {
      id: staffProfile.id,
      name: staffProfile.fullName,
      role: staffProfile.role,
      vendorId: staffProfile.vendorId
    });
    
    return c.json({
      success: true,
      staff: {
        id: staffProfile.id,
        staffId: staffProfile.staffId,
        vendorId: staffProfile.vendorId,
        fullName: staffProfile.fullName,
        phone: staffProfile.phone,
        email: staffProfile.email,
        role: staffProfile.role,
        roleType: staffProfile.roleType,
        specializations: staffProfile.specializations,
        isActive: staffProfile.isActive,
        consultationFee: staffProfile.consultationFee,
        services: staffProfile.services || [],
        availability: staffProfile.availability,
        totalAppointments: staffProfile.totalAppointments || 0,
        completedAppointments: staffProfile.completedAppointments || 0,
        totalEarnings: staffProfile.totalEarnings || 0,
        rating: staffProfile.rating || 0,
        reviewCount: staffProfile.reviewCount || 0
      }
    });
    
  } catch (error) {
    console.error("Error during staff login:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /staff/vendor/:vendorId
 * ✅ MIGRATED TO SQL: Now uses SQL-based staff repository
 * Get all staff for a vendor
 */
app.get("/make-server-3dd53475/staff/vendor/:vendorId", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    
    // ✅ USE SQL-BASED STAFF REPOSITORY (NO KV STORE)
    const staffRepo = getStaffRepository();
    const staff = await staffRepo.findByVendorId(vendorId);
    
    return c.json({ staff });
    
  } catch (error) {
    console.error("Error fetching vendor staff:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /staff/:staffId/appointments
 * ✅ MIGRATED TO SQL: Get all appointments for a staff member
 */
app.get("/make-server-3dd53475/staff/:staffId/appointments", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const status = c.req.query("status"); // upcoming, completed, cancelled
    
    console.log(`📅 [SQL] Fetching appointments for staff: ${staffId}, status: ${status || 'all'}`);
    
    // ✅ SQL: Get bookings from bookings table
    const bookingsRepo = getBookingsRepository();
    
    // Find staff by ID first to get the UUID
    const staffRepo = getStaffRepository();
    const staff = await staffRepo.findById(staffId);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // Get bookings for this staff
    const bookings = await bookingsRepo.findByStaff(staff.id, {
      status: status as any,
    });
    
    console.log(`✅ [SQL] Found ${bookings.length} appointments for staff`);
    
    return c.json({ appointments: bookings });
    
  } catch (error) {
    console.error("Error fetching staff appointments:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PUT /staff/:staffId/availability
 * ✅ MIGRATED TO SQL: Update staff schedule/availability
 */
app.put("/make-server-3dd53475/staff/:staffId/availability", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const { availability } = await c.req.json();
    
    // ✅ SQL: Update staff working_hours in staff table
    const staffRepo = getStaffRepository();
    const staff = await staffRepo.findById(staffId);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // Update working hours
    const client = getDbClient();
    await client
      .from('staff')
      .update({
        working_hours: availability,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
    
    console.log(`✅ [SQL] Staff availability updated: ${staffId}`);
    
    return c.json({ success: true, availability });
    
  } catch (error) {
    console.error("Error updating staff availability:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /staff/:staffId/analytics
 * ✅ MIGRATED TO SQL: Get staff performance analytics
 */
app.get("/make-server-3dd53475/staff/:staffId/analytics", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const period = c.req.query("period") || "month"; // day, week, month, year
    
    // ✅ SQL: Get staff from SQL
    const staffRepo = getStaffRepository();
    const staff = await staffRepo.findById(staffId);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // ✅ SQL: Get bookings for this staff
    const bookingsRepo = getBookingsRepository();
    const allBookings = await bookingsRepo.findByStaff(staff.id);
    
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
    
    // Filter bookings by period
    const periodBookings = allBookings.filter((booking: any) => 
      booking.created_at && new Date(booking.created_at) >= periodStart
    );
    
    // Calculate analytics
    const completed = periodBookings.filter((b: any) => b.status === 'completed');
    const cancelled = periodBookings.filter((b: any) => b.status === 'cancelled');
    const upcoming = periodBookings.filter((b: any) => b.status === 'confirmed' || b.status === 'pending');
    
    const totalEarnings = completed.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
    const avgRating = staff.rating || 0;
    
    const analytics = {
      period,
      totalAppointments: periodBookings.length,
      completed: completed.length,
      cancelled: cancelled.length,
      upcoming: upcoming.length,
      totalEarnings,
      avgRating,
      reviewCount: staff.reviewCount || 0,
      completionRate: periodBookings.length > 0 
        ? ((completed.length / periodBookings.length) * 100).toFixed(1)
        : 0,
      cancellationRate: periodBookings.length > 0
        ? ((cancelled.length / periodBookings.length) * 100).toFixed(1)
        : 0
    };
    
    return c.json({ analytics });
    
  } catch (error) {
    console.error("Error fetching staff analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;

