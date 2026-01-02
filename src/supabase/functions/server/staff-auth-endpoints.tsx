/**
 * ============================================================================
 * STAFF AUTHENTICATION & MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Handles separate login for doctors/staff with unique mobile numbers
 * Supports multi-vendor-type staff (vets, groomers, trainers, clinic doctors)
 * 
 * KV Operations: 27 → 0
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Staff data from staff table
 * ✅ Appointments from bookings table
 * ✅ Services from staff_services and vendor_services tables
 */

import { Hono } from "hono";
import { getStaffRepository } from '../../../supabase/lib/repositories/staff';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings';
import { getVendorsRepository } from '../../../supabase/lib/repositories/vendors';
import { getDbClient } from '../../../supabase/lib/db';

export function staffAuthEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // Add logging middleware for debugging
  app.use(`${BASE_PATH}/*`, async (c, next) => {
    console.log(`[STAFF AUTH] ${c.req.method} ${c.req.url}`);
    await next();
  });

  // ============================================================================
  // STAFF AUTHENTICATION
  // ============================================================================

  /**
   * POST /staff/auth/check-phone
   * Check if staff phone exists and return their profile
   * ✅ SQL-ONLY: Uses StaffRepository.findByPhone
   */
  app.post(`${BASE_PATH}/staff/auth/check-phone`, async (c) => {
    try {
      const { phone } = await c.req.json();
      
      if (!phone) {
        return c.json({ error: "Phone number is required" }, 400);
      }
      
      console.log(`🔍 [STAFF CHECK] Checking staff phone: ${phone}`);
      
      // ✅ SQL: Find staff by phone
      const staffRepo = getStaffRepository();
      const staffProfile = await staffRepo.findByPhone(phone);
      
      if (staffProfile) {
        console.log(`✅ [STAFF CHECK] Staff found:`, {
          id: staffProfile.id,
          name: staffProfile.fullName,
          phone: staffProfile.phone,
          role: staffProfile.role
        });
        return c.json({
          exists: true,
          staff: staffProfile
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
   * Staff login with phone number
   * ✅ SQL-ONLY: Uses StaffRepository.findByPhone and updateLastLogin
   */
  app.post(`${BASE_PATH}/staff/auth/login`, async (c) => {
    try {
      const { phone } = await c.req.json();
      
      if (!phone) {
        return c.json({ error: "Phone number is required" }, 400);
      }
      
      console.log(`🔐 [STAFF LOGIN] Login attempt: ${phone}`);
      
      // ✅ SQL: Find staff by phone
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
      
      // ✅ SQL: Update last login
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
          vendorId: staffProfile.vendorId,
          fullName: staffProfile.fullName,
          phone: staffProfile.phone,
          role: staffProfile.role,
          roleType: staffProfile.roleType,
          specializations: staffProfile.specializations,
          photo: staffProfile.photo,
          degree: staffProfile.degree,
          experience: staffProfile.experience,
          bio: staffProfile.bio,
          consultationFee: staffProfile.consultationFee,
          services: staffProfile.services,
          availability: staffProfile.availability,
          isActive: staffProfile.isActive,
          totalAppointments: staffProfile.totalAppointments,
          completedAppointments: staffProfile.completedAppointments,
          totalEarnings: staffProfile.totalEarnings,
          rating: staffProfile.rating,
          reviewCount: staffProfile.reviewCount
        }
      });
      
    } catch (error) {
      console.error("Error during staff login:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // STAFF MANAGEMENT (Vendor creates/manages staff)
  // ============================================================================

  /**
   * POST /staff/create
   * Create new staff member (doctor, groomer, trainer)
   * ✅ SQL-ONLY: Uses StaffRepository.create
   */
  app.post(`${BASE_PATH}/staff/create`, async (c) => {
    try {
      const staffData = await c.req.json();
      
      console.log(`📝 Creating staff member:`, staffData);
      
      // Validate required fields
      const required = ['vendorId', 'fullName', 'phone', 'role'];
      for (const field of required) {
        if (!staffData[field]) {
          return c.json({ error: `${field} is required` }, 400);
        }
      }
      
      // ✅ SQL: Check if phone already exists
      const staffRepo = getStaffRepository();
      const existingStaff = await staffRepo.findByPhone(staffData.phone);
      
      if (existingStaff) {
        return c.json({ error: "Phone number already registered" }, 400);
      }
      
      // ✅ SQL: Create staff
      const staff = await staffRepo.create({
        vendor_id: staffData.vendorId,
        full_name: staffData.fullName,
        phone: staffData.phone,
        email: staffData.email,
        role: staffData.role,
        role_type: staffData.roleType,
        specialization: staffData.specializations?.[0] || staffData.specialization,
        experience_years: staffData.experience || 0,
        is_active: true
      });
      
      // Update working hours if provided
      if (staffData.availability) {
        await staffRepo.update(staff.id, {
          working_hours: staffData.availability
        });
      }
      
      console.log(`✅ Staff created successfully: ${staff.id}`);
      
      return c.json({
        success: true,
        staffId: staff.id,
        staff
      });
      
    } catch (error) {
      console.error("Error creating staff:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * GET /staff/:staffId
   * Get staff profile
   * ✅ SQL-ONLY: Uses StaffRepository.findById
   */
  app.get(`${BASE_PATH}/staff/:staffId`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      
      // ✅ SQL: Get staff profile
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        return c.json({ error: "Staff not found" }, 404);
      }
      
      return c.json({ staff });
      
    } catch (error) {
      console.error("Error fetching staff:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * GET /staff/vendor/:vendorId
   * Get all staff for a vendor
   * ✅ SQL-ONLY: Uses StaffRepository.findByVendorId
   */
  app.get(`${BASE_PATH}/staff/vendor/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param("vendorId");
      
      // ✅ SQL: Get all staff for vendor
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findByVendorId(vendorId);
      
      return c.json({ staff });
      
    } catch (error) {
      console.error("Error fetching vendor staff:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * PUT /staff/:staffId
   * Update staff profile
   * ✅ SQL-ONLY: Uses StaffRepository.update
   */
  app.put(`${BASE_PATH}/staff/:staffId`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      const updates = await c.req.json();
      
      // ✅ SQL: Update staff
      const staffRepo = getStaffRepository();
      const updatedStaff = await staffRepo.update(staffId, {
        full_name: updates.fullName,
        phone: updates.phone,
        email: updates.email,
        role: updates.role,
        role_type: updates.roleType,
        specialization: updates.specializations?.[0] || updates.specialization,
        experience_years: updates.experience,
        is_active: updates.isActive !== undefined ? updates.isActive : undefined,
        working_hours: updates.availability
      });
      
      console.log(`✅ Staff updated: ${staffId}`);
      
      return c.json({
        success: true,
        staff: updatedStaff
      });
      
    } catch (error) {
      console.error("Error updating staff:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * DELETE /staff/:staffId
   * Delete staff (soft delete)
   * ✅ SQL-ONLY: Uses StaffRepository.update to set is_active=false
   */
  app.delete(`${BASE_PATH}/staff/:staffId`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      
      // ✅ SQL: Soft delete (deactivate)
      const staffRepo = getStaffRepository();
      await staffRepo.update(staffId, {
        is_active: false
      });
      
      console.log(`✅ Staff deactivated: ${staffId}`);
      
      return c.json({ success: true });
      
    } catch (error) {
      console.error("Error deleting staff:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // STAFF APPOINTMENTS
  // ============================================================================

  /**
   * GET /staff/:staffId/appointments
   * Get all appointments for a staff member
   * ✅ SQL-ONLY: Uses BookingsRepository.findByStaff
   */
  app.get(`${BASE_PATH}/staff/:staffId/appointments`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      const status = c.req.query("status"); // upcoming, completed, cancelled
      
      console.log(`📅 Fetching appointments for staff: ${staffId}, status: ${status || 'all'}`);
      
      // ✅ SQL: Get bookings for this staff
      const bookingsRepo = getBookingsRepository();
      let bookings = await bookingsRepo.findByStaff(staffId);
      
      // Filter by status if provided
      if (status) {
        bookings = bookings.filter((b: any) => {
          if (status === 'upcoming') {
            return b.status === 'confirmed' || b.status === 'pending';
          }
          if (status === 'completed') {
            return b.status === 'completed';
          }
          if (status === 'cancelled') {
            return b.status === 'cancelled';
          }
          return b.status === status;
        });
      }
      
      // Sort by date
      bookings.sort((a: any, b: any) => {
        const dateA = new Date(a.booking_date + ' ' + a.booking_time);
        const dateB = new Date(b.booking_date + ' ' + b.booking_time);
        return dateA.getTime() - dateB.getTime();
      });
      
      console.log(`✅ Found ${bookings.length} appointments for staff`);
      
      return c.json({ appointments: bookings });
      
    } catch (error) {
      console.error("Error fetching staff appointments:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // STAFF SERVICES & SCHEDULE MANAGEMENT
  // ============================================================================

  /**
   * PUT /staff/:staffId/services
   * Update staff services
   * ✅ SQL-ONLY: Updates staff_services table
   */
  app.put(`${BASE_PATH}/staff/:staffId/services`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      const body = await c.req.json();
      const serviceIds = body.serviceIds || body.services || [];
      
      // ✅ SQL: Get staff
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        return c.json({ error: "Staff not found" }, 404);
      }
      
      const vendorId = staff.vendorId;
      
      // ✅ SQL: Get vendor services from vendor_services table
      const db = getDbClient();
      const { data: vendorServices } = await db
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('publish_status', 'published')
        .eq('is_enabled', true)
        .in('id', serviceIds);
      
      // ✅ SQL: Update staff_services table
      // First, disable all existing staff services
      await db
        .from('staff_services')
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq('staff_id', staff.id);
      
      // Then, enable/insert selected services
      const staffServices = serviceIds.map((serviceId: string) => {
        const vendorService = vendorServices?.find((vs: any) => vs.id === serviceId);
        return {
          staff_id: staff.id,
          service_id: serviceId,
          is_enabled: true,
          custom_price: vendorService?.custom_price || vendorService?.price || null,
          custom_duration: vendorService?.custom_duration || vendorService?.duration_minutes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
      
      if (staffServices.length > 0) {
        await db
          .from('staff_services')
          .upsert(staffServices, { onConflict: 'staff_id,service_id' });
      }
      
      console.log(`✅ Assigned ${serviceIds.length} services to staff ${staffId}`);
      
      return c.json({ success: true, services: vendorServices || [] });
      
    } catch (error) {
      console.error("Error updating staff services:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/availability
   * Update staff schedule/availability
   * ✅ SQL-ONLY: Updates staff.working_hours JSONB field
   */
  app.put(`${BASE_PATH}/staff/:staffId/availability`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      const { availability } = await c.req.json();
      
      // ✅ SQL: Update staff availability
      const staffRepo = getStaffRepository();
      await staffRepo.update(staffId, {
        working_hours: availability
      });
      
      console.log(`✅ Staff availability updated: ${staffId}`);
      
      return c.json({ success: true, availability });
      
    } catch (error) {
      console.error("Error updating staff availability:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // STAFF ANALYTICS
  // ============================================================================

  /**
   * GET /staff/:staffId/analytics
   * Get staff performance analytics
   * ✅ SQL-ONLY: Uses BookingsRepository for analytics
   */
  app.get(`${BASE_PATH}/staff/:staffId/analytics`, async (c) => {
    try {
      const staffId = c.req.param("staffId");
      const period = c.req.query("period") || "month";
      
      // ✅ SQL: Get staff
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        return c.json({ error: "Staff not found" }, 404);
      }
      
      // ✅ SQL: Get bookings for this staff
      const bookingsRepo = getBookingsRepository();
      let staffBookings = await bookingsRepo.findByStaff(staffId);
      
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
      const periodBookings = staffBookings.filter((booking: any) => {
        const bookingDate = new Date(booking.created_at);
        return bookingDate >= periodStart;
      });
      
      // Calculate analytics
      const completed = periodBookings.filter((b: any) => b.status === 'completed');
      const cancelled = periodBookings.filter((b: any) => b.status === 'cancelled');
      const upcoming = periodBookings.filter((b: any) => 
        b.status === 'confirmed' || b.status === 'pending'
      );
      
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
          : '0',
        cancellationRate: periodBookings.length > 0
          ? ((cancelled.length / periodBookings.length) * 100).toFixed(1)
          : '0'
      };
      
      return c.json({ analytics });
      
    } catch (error) {
      console.error("Error fetching staff analytics:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  console.log('✅ Staff Auth Endpoints registered (SQL-only)');
}
