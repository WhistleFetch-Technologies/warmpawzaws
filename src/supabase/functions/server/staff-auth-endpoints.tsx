/**
 * Staff Authentication & Management Endpoints
 * Handles separate login for doctors/staff with unique mobile numbers
 * Supports multi-vendor-type staff (vets, groomers, trainers, clinic doctors)
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Add logging middleware for debugging
app.use('*', async (c, next) => {
  console.log(`[STAFF AUTH] ${c.req.method} ${c.req.url}`);
  await next();
});

// ============================================================================
// STAFF AUTHENTICATION
// ============================================================================

/**
 * POST /staff/auth/check-phone
 * Check if staff phone exists and return their profile
 */
app.post("/staff/auth/check-phone", async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (!phone) {
      return c.json({ error: "Phone number is required" }, 400);
    }
    
    console.log(`🔍 [STAFF CHECK] Checking staff phone: ${phone}`);
    
    // Search for staff by phone across all vendors
    const allStaffKeys = await kv.getByPrefix("staff:");
    console.log(`📋 [STAFF CHECK] Total staff records found: ${allStaffKeys.length}`);
    
    // Log first few staff records for debugging
    if (allStaffKeys.length > 0) {
      console.log(`📋 [STAFF CHECK] Sample staff records (first 3):`);
      allStaffKeys.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`   ${idx + 1}. Phone: ${item?.phone || 'N/A'}, Name: ${item?.fullName || 'N/A'}, Status: ${item?.status || 'N/A'}`);
      });
    }
    
    // The KV store returns objects directly, not wrapped in .value
    const staffProfile = allStaffKeys.find((item: any) => {
      const staffPhone = item?.phone;
      const staffStatus = item?.status;
      const staffIsActive = item?.isActive;
      console.log(`   Comparing: ${staffPhone} === ${phone}, status: ${staffStatus}, isActive: ${staffIsActive}`);
      // ✅ CRITICAL FIX: Check BOTH status==='active' (old staff) AND isActive===true (new staff)
      const isActiveStaff = staffStatus === 'active' || staffIsActive === true;
      return staffPhone === phone && isActiveStaff;
    });
    
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
 */
app.post("/staff/auth/login", async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (!phone) {
      return c.json({ error: "Phone number is required" }, 400);
    }
    
    console.log(`🔐 [STAFF LOGIN] Login attempt: ${phone}`);
    
    // Find staff by phone
    const allStaffKeys = await kv.getByPrefix("staff:");
    console.log(`📋 [STAFF LOGIN] Total staff records: ${allStaffKeys.length}`);
    
    // The KV store returns objects directly, not wrapped in .value
    const staffProfile = allStaffKeys.find((item: any) => {
      const staffPhone = item?.phone;
      const staffStatus = item?.status;
      const staffIsActive = item?.isActive;
      console.log(`   Login check: ${staffPhone} === ${phone}, status: ${staffStatus}, isActive: ${staffIsActive}`);
      // ✅ CRITICAL FIX: Check BOTH status==='active' (old staff) AND isActive===true (new staff)
      const isActiveStaff = staffStatus === 'active' || staffIsActive === true;
      return staffPhone === phone && isActiveStaff;
    });
    
    if (!staffProfile) {
      console.log(`❌ [STAFF LOGIN] Staff not found or inactive for phone: ${phone}`);
      return c.json({ error: "Staff not found or inactive" }, 404);
    }
    
    const staff = staffProfile;
    
    // Update last login
    staff.lastLogin = new Date().toISOString();
    await kv.set(`staff:${staff.id}`, staff);
    
    console.log(`✅ [STAFF LOGIN] Login successful:`, {
      id: staff.id,
      name: staff.fullName,
      role: staff.role,
      vendorId: staff.vendorId
    });
    
    return c.json({
      success: true,
      staff: {
        id: staff.id,
        vendorId: staff.vendorId,
        fullName: staff.fullName,
        phone: staff.phone,
        role: staff.role,
        roleType: staff.roleType, // 'vet', 'groomer', 'trainer', 'clinic_doctor'
        specializations: staff.specializations,
        photo: staff.photo,
        degree: staff.degree,
        experience: staff.experience,
        bio: staff.bio,
        consultationFee: staff.consultationFee,
        services: staff.services,
        availability: staff.availability,
        isActive: staff.isActive,
        totalAppointments: staff.totalAppointments,
        completedAppointments: staff.completedAppointments,
        totalEarnings: staff.totalEarnings,
        rating: staff.rating,
        reviewCount: staff.reviewCount
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
 */
app.post("/staff/create", async (c) => {
  try {
    const staffData = await c.req.json();
    
    console.log(`📝 Creating staff member:`, staffData);
    
    // Validate required fields
    const required = ['vendorId', 'fullName', 'phone', 'role', 'roleType', 'specializations', 'photo', 'degree'];
    for (const field of required) {
      if (!staffData[field]) {
        return c.json({ error: `${field} is required` }, 400);
      }
    }
    
    // Check if phone already exists
    const allStaffKeys = await kv.getByPrefix("staff:");
    const existingStaff = allStaffKeys.find((item: any) => 
      item.value?.phone === staffData.phone
    );
    
    if (existingStaff) {
      return c.json({ error: "Phone number already registered" }, 400);
    }
    
    // Generate staff ID
    const staffId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const staff = {
      id: staffId,
      vendorId: staffData.vendorId,
      fullName: staffData.fullName,
      phone: staffData.phone,
      email: staffData.email || '',
      role: staffData.role, // 'doctor', 'groomer', 'trainer', 'assistant'
      roleType: staffData.roleType, // 'vet', 'groomer', 'trainer', 'clinic_doctor'
      specializations: staffData.specializations, // Array of specializations
      degree: staffData.degree, // Education qualification
      experience: staffData.experience || 0,
      photo: staffData.photo, // Photo URL
      bio: staffData.bio || '',
      consultationFee: staffData.consultationFee || 0,
      
      // Service configuration
      services: staffData.services || [], // Services this staff can perform
      
      // Schedule
      availability: staffData.availability || {
        monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
        saturday: { enabled: true, slots: [{ start: '09:00', end: '12:00' }] },
        sunday: { enabled: false, slots: [] }
      },
      
      // Status
      status: 'active', // 'active', 'inactive', 'on_leave'
      isActive: true,
      
      // Stats
      totalAppointments: 0,
      completedAppointments: 0,
      totalEarnings: 0,
      rating: 0,
      reviewCount: 0,
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null
    };
    
    // Save staff
    await kv.set(`staff:${staffId}`, staff);
    
    // Add to vendor's staff list
    const vendorStaffKey = `vendor:${staffData.vendorId}:staff`;
    const vendorStaff = await kv.get(vendorStaffKey) || [];
    vendorStaff.push(staffId);
    await kv.set(vendorStaffKey, vendorStaff);
    
    console.log(`✅ Staff created successfully: ${staffId}`);
    
    return c.json({
      success: true,
      staffId,
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
 */
app.get("/staff/:staffId", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const staff = await kv.get(`staff:${staffId}`);
    
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
 */
app.get("/staff/vendor/:vendorId", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    
    // Get staff IDs
    const vendorStaffKey = `vendor:${vendorId}:staff`;
    const staffIds = await kv.get(vendorStaffKey) || [];
    
    // Get staff details
    const staff = await Promise.all(
      staffIds.map(async (id: string) => {
        const staffData = await kv.get(`staff:${id}`);
        return staffData;
      })
    );
    
    // Filter out null values
    const activeStaff = staff.filter(s => s !== null);
    
    return c.json({ staff: activeStaff });
    
  } catch (error) {
    console.error("Error fetching vendor staff:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PUT /staff/:staffId
 * Update staff profile
 */
app.put("/staff/:staffId", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const updates = await c.req.json();
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // Update staff
    const updatedStaff = {
      ...staff,
      ...updates,
      id: staffId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`staff:${staffId}`, updatedStaff);
    
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
 */
app.delete("/staff/:staffId", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // Soft delete
    staff.status = 'inactive';
    staff.isActive = false;
    staff.updatedAt = new Date().toISOString();
    
    await kv.set(`staff:${staffId}`, staff);
    
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
 */
app.get("/staff/:staffId/appointments", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const status = c.req.query("status"); // upcoming, completed, cancelled
    
    console.log(`📅 Fetching appointments for staff: ${staffId}, status: ${status || 'all'}`);
    
    // Get all bookings
    const bookingKeys = await kv.getByPrefix("booking:");
    
    // Filter bookings for this staff
    // getByPrefix returns objects directly, not wrapped in .value
    const staffBookings = bookingKeys
      .filter((booking: any) => {
        // Check if booking is valid
        if (!booking) return false;
        // Check if this booking belongs to this staff member
        if (booking.staffId !== staffId && booking.doctorId !== staffId) return false;
        // Filter by status if provided
        if (status && booking.status !== status) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        return new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime();
      });
    
    console.log(`✅ Found ${staffBookings.length} appointments for staff`);
    
    return c.json({ appointments: staffBookings });
    
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
 * 
 * ✅ FIXED: Now properly stores full service objects with isEnabled, isLive, isPublished flags
 */
app.put("/staff/:staffId/services", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const body = await c.req.json();
    const serviceIds = body.serviceIds || body.services || []; // Accept both field names
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // ✅ FIX: Get vendor to access full service catalog from vendor_services
    const vendorId = staff.vendorId;
    if (!vendorId) {
      return c.json({ error: "Staff has no associated vendor" }, 400);
    }
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    
    // ✅ NEW: Load vendor's PUBLISHED services from all styles
    const serviceStyles = ['at_home', 'at_center', 'tele'];
    const allVendorServices: any[] = [];
    
    for (const style of serviceStyles) {
      const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
      const vendorServicesData = await kv.get(vendorServicesKey);
      
      if (vendorServicesData && vendorServicesData.services) {
        // Only include PUBLISHED services
        const publishedServices = vendorServicesData.services.filter(
          (s: any) => s.publishStatus === 'published' && s.isEnabled === true
        );
        allVendorServices.push(...publishedServices);
      }
    }
    
    console.log(`📋 Found ${allVendorServices.length} published vendor services`);
    
    // ✅ Build staff service objects - ONLY set isActive for staff
    const fullServices = serviceIds.map((serviceId: string) => {
      // Find service in vendor's published catalog
      const vendorService = allVendorServices.find((s: any) => s.serviceId === serviceId);
      
      if (!vendorService) {
        console.warn(`⚠️ Service ${serviceId} not found in vendor's published catalog`);
        return null;
      }
      
      // Return service with ONLY isActive flag (staff level)
      // Staff inherits all other properties from vendor's published service
      return {
        ...vendorService,
        isActive: true,  // ✅ STAFF LEVEL: Only this flag matters
        activatedAt: new Date().toISOString(),
      };
    }).filter(Boolean); // Remove nulls
    
    staff.services = fullServices;
    staff.assignedServices = serviceIds; // Keep IDs for backward compatibility
    staff.updatedAt = new Date().toISOString();
    
    await kv.set(`staff:${staffId}`, staff);
    
    console.log(`✅ Assigned ${fullServices.length} services to staff ${staffId}`);
    
    // ✅ IMPORTANT: Also update vendor's staff array if it exists
    if (vendor.staff && Array.isArray(vendor.staff)) {
      const staffIndex = vendor.staff.findIndex((s: any) => s.staffId === staffId || s.id === staffId);
      if (staffIndex !== -1) {
        // Update the staff member in vendor's array
        vendor.staff[staffIndex] = {
          ...vendor.staff[staffIndex],
          services: fullServices,
          assignedServices: serviceIds,
          updatedAt: staff.updatedAt
        };
        await kv.set(`vendor:${vendorId}`, vendor);
        console.log(` Updated vendor's staff array for ${staffId}`);
      }
    }
    
    // ✅ ALSO: Update the dedicated vendor:X:staff:Y key if it exists
    const vendorStaffKey = `vendor:${vendorId}:staff:${staffId}`;
    const vendorStaffRecord = await kv.get(vendorStaffKey);
    if (vendorStaffRecord) {
      vendorStaffRecord.services = fullServices;
      vendorStaffRecord.assignedServices = serviceIds;
      vendorStaffRecord.updatedAt = staff.updatedAt;
      await kv.set(vendorStaffKey, vendorStaffRecord);
      console.log(`✅ Updated vendor staff record at ${vendorStaffKey}`);
    }
    
    console.log(`✅ Staff services updated: ${staffId}, ${fullServices.length} services with full data`);
    
    return c.json({ success: true, services: fullServices });
    
  } catch (error) {
    console.error("Error updating staff services:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PUT /staff/:staffId/availability
 * Update staff schedule/availability
 */
app.put("/staff/:staffId/availability", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const { availability } = await c.req.json();
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    staff.availability = availability;
    staff.updatedAt = new Date().toISOString();
    
    await kv.set(`staff:${staffId}`, staff);
    
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
 */
app.get("/staff/:staffId/analytics", async (c) => {
  try {
    const staffId = c.req.param("staffId");
    const period = c.req.query("period") || "month"; // day, week, month, year
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({ error: "Staff not found" }, 404);
    }
    
    // Get all bookings for this staff
    const bookingKeys = await kv.getByPrefix("booking:");
    // getByPrefix returns objects directly, not wrapped in .value
    const staffBookings = bookingKeys
      .filter((booking: any) => {
        // Check if booking is valid
        if (!booking) return false;
        // Check if this booking belongs to this staff member
        return booking.staffId === staffId || booking.doctorId === staffId;
      });
    
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
    const periodBookings = staffBookings.filter((booking: any) => 
      booking.createdAt && new Date(booking.createdAt) >= periodStart
    );
    
    // Calculate analytics
    const completed = periodBookings.filter((b: any) => b.status === 'completed');
    const cancelled = periodBookings.filter((b: any) => b.status === 'cancelled');
    const upcoming = periodBookings.filter((b: any) => b.status === 'confirmed' || b.status === 'pending');
    
    const totalEarnings = completed.reduce((sum: number, b: any) => sum + (b.price || 0), 0);
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