/**
 * ============================================================================
 * GROOMING BOOKING APIS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Address management
 * - Wallet operations
 * - Coupon management
 * - Slot availability
 * - Booking creation
 * - OTP generation and verification
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (P1)
 * ============================================================================
 */

import { Hono } from "npm:hono@4";
import { getAddressesRepository } from "../../lib/repositories/addresses.ts";
import { getWalletsRepository } from "../../lib/repositories/wallets.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getOtpRepository } from "../../lib/repositories/otp.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getPetsRepository } from "../../lib/repositories/pets.ts";
import { getSchedulingRepository } from "../../lib/repositories/scheduling.ts";
import { getDbClient } from "../../lib/db.ts";
import { normalizePhone } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { broadcastSlotUpdate } from "./websocket-server.tsx";

const groomingBookingAPIs = new Hono();

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// ========================================
// ADDRESS MANAGEMENT APIs
// ========================================

groomingBookingAPIs.get("/make-server-3dd53475/customer/addresses/:phone", async (c) => {
  try {
    const phone = c.req.param("phone");
    const cleanPhone = normalizePhone(phone);

    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    const addressesRepo = getAddressesRepository();
    const addresses = await addressesRepo.findByCustomer(customer.id);
    
    return sendSuccess(c, { addresses, count: addresses.length });
  } catch (error) {
    console.error("❌ [GET-ADDRESSES] Error:", error);
    return sendError(c, error, 500);
  }
});

groomingBookingAPIs.post("/make-server-3dd53475/customer/addresses/:phone", async (c) => {
  try {
    const phone = c.req.param("phone");
    const cleanPhone = normalizePhone(phone);
    const addressData = await c.req.json();

    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    const addressesRepo = getAddressesRepository();
    const address = await addressesRepo.create({
      customer_id: customer.id,
      address_type: addressData.type || 'home',
      full_name: addressData.fullName || customer.full_name || 'Customer',
      phone: addressData.phone || cleanPhone,
      address_line1: addressData.address || addressData.addressLine1,
      address_line2: addressData.addressLine2,
      city: addressData.city,
      state: addressData.state,
      pincode: addressData.pincode,
      landmark: addressData.landmark,
      is_default: addressData.isDefault || false
    });
    
    return sendSuccess(c, { address });
  } catch (error) {
    console.error("❌ [ADD-ADDRESS] Error:", error);
    return sendError(c, error, 500);
  }
});

groomingBookingAPIs.delete("/make-server-3dd53475/customer/addresses/:phone/:addressId", async (c) => {
  try {
    const phone = c.req.param("phone");
    const addressId = c.req.param("addressId");
    const cleanPhone = normalizePhone(phone);

    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    const addressesRepo = getAddressesRepository();
    await addressesRepo.delete(addressId);
    
    return sendSuccess(c, { message: 'Address deleted' });
  } catch (error) {
    console.error("❌ [DELETE-ADDRESS] Error:", error);
    return sendError(c, error, 500);
  }
});

// ========================================
// WALLET APIs
// ========================================

groomingBookingAPIs.get("/make-server-3dd53475/customer/wallet/:phone", async (c) => {
  try {
    const phone = c.req.param("phone");
    const cleanPhone = normalizePhone(phone);

    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);
    
    return sendSuccess(c, { wallet });
  } catch (error) {
    console.error("❌ [GET-WALLET] Error:", error);
    return sendError(c, error, 500);
  }
});

// ========================================
// COUPON APIs
// ========================================

groomingBookingAPIs.get("/make-server-3dd53475/coupons/active", async (c) => {
  try {
    const client = getDbClient();
    const { data: coupons, error } = await client
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .or('expires_at.is.null');
    
    if (error) {
      throw new Error(`Failed to fetch coupons: ${error.message}`);
    }
    
    return sendSuccess(c, { coupons: coupons || [] });
  } catch (error) {
    console.error("❌ [GET-COUPONS] Error:", error);
    return sendError(c, error, 500);
  }
});

// ========================================
// SLOT AVAILABILITY
// ========================================

groomingBookingAPIs.get("/make-server-3dd53475/vendor/:vendorId/slots", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    const date = c.req.query("date");
    
    if (!date) {
      return sendError(c, 'Date parameter required', 400);
    }

    const schedulingRepo = getSchedulingRepository();
    const vendorSchedules = await schedulingRepo.getVendorSchedules(vendorId);
    
    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay();
    const daySchedule = vendorSchedules.find((s: any) => s.day_of_week === dayOfWeek);
    
    if (!daySchedule || !daySchedule.is_available) {
      return sendSuccess(c, { slots: [], message: "Vendor not available on this day" });
    }

    // Get bookings for this date
    const bookingsRepo = getBookingsRepository();
    const dateBookings = await bookingsRepo.findByVendorAndDate(vendorId, date);
    
    // Generate slots
    const slots: any[] = [];
    const timeWindows = daySchedule.time_windows || [];
    
    for (const window of timeWindows) {
      if (!window.is_enabled) continue;
      
      const startMinutes = timeToMinutes(window.start_time);
      const endMinutes = timeToMinutes(window.end_time);
      const slotDuration = 30;
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
        const time = minutesToTime(minutes);
        const bookedCount = dateBookings.filter((b: any) => {
          const bookingTime = b.scheduled_time?.split(' - ')[0];
          return bookingTime === time;
        }).length;
        
        const capacity = window.max_bookings || 3;
        
        slots.push({
          time,
          available: bookedCount < capacity,
          bookedCount,
          capacity
        });
      }
    }
    
    return sendSuccess(c, { slots });
  } catch (error) {
    console.error("❌ [GET-SLOTS] Error:", error);
    return sendError(c, error, 500);
  }
});

// ========================================
// BOOKING CREATION
// ========================================

groomingBookingAPIs.post("/make-server-3dd53475/customer/booking", async (c) => {
  try {
    const bookingData = await c.req.json();
    const cleanPhone = normalizePhone(bookingData.customerPhone);
    
    const customersRepo = getCustomersRepository();
    const vendorsRepo = getVendorsRepository();
    const petsRepo = getPetsRepository();
    const bookingsRepo = getBookingsRepository();
    const otpRepo = getOtpRepository();
    
    const customer = await customersRepo.findByPhone(cleanPhone);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const vendor = await vendorsRepo.findById(bookingData.vendorId);
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }
    
    const pet = await petsRepo.findById(bookingData.petId);
    if (!pet) {
      return sendError(c, 'Pet not found', 404);
    }
    
    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Create booking (bookings table uses scheduled_date/scheduled_time, but repository maps booking_date/booking_time)
    const booking = await bookingsRepo.create({
      customer_id: customer.id,
      vendor_id: bookingData.vendorId,
      staff_id: bookingData.staffId || undefined,
      service_id: bookingData.serviceId,
      booking_date: bookingData.scheduledDate, // Repository will map to scheduled_date
      booking_time: bookingData.scheduledTime, // Repository will map to scheduled_time
      service_type: bookingData.serviceType || 'grooming',
      base_price: parseFloat(bookingData.amount || '0'),
      discount_amount: bookingData.couponApplied ? parseFloat(bookingData.couponApplied.discount || '0') : 0,
      tax_amount: 0,
      total_amount: parseFloat(bookingData.amount || '0'),
      coupon_code: bookingData.couponApplied?.code || undefined,
      notes: `Pet: ${bookingData.petId}, Service: ${bookingData.serviceName}`
    });
    
    // Set completion OTP
    await bookingsRepo.setOtp(booking.id, otp, 7 * 24 * 60); // 7 days
    
    // Save OTP
    await otpRepo.create({
      phone: cleanPhone,
      otp_code: otp,
      otp_type: 'booking_completion',
      expires_in_minutes: 7 * 24 * 60, // 7 days
      max_attempts: 3
    });
    
    // Broadcast slot update
    if (bookingData.staffId) {
      try {
        broadcastSlotUpdate({
          staffId: bookingData.staffId,
          vendorId: bookingData.vendorId,
          date: bookingData.scheduledDate,
          time: bookingData.scheduledTime,
          action: 'booked',
          bookingId: booking.id,
          customerName: pet.name || 'Customer',
          serviceName: bookingData.serviceName,
          duration: bookingData.serviceDuration || 30
        });
      } catch (wsError) {
        console.warn('⚠️ WebSocket update failed:', wsError);
      }
    }
    
    return sendSuccess(c, {
      bookingId: booking.id,
      booking,
      otp,
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error('❌ [CREATE-BOOKING] Error:', error);
    return sendError(c, error, 500);
  }
});

// ========================================
// OTP APIs
// ========================================

groomingBookingAPIs.post("/make-server-3dd53475/booking/:bookingId/generate-otp", async (c) => {
  try {
    const bookingId = c.req.param("bookingId");
    const bookingsRepo = getBookingsRepository();
    const otpRepo = getOtpRepository();
    
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Get customer phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(booking.customer_id);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // Save OTP
    await otpRepo.create({
      phone: customer.phone,
      otp_code: otp,
      otp_type: 'booking_completion',
      expires_in_minutes: 60,
      max_attempts: 3
    });
    
    // Update booking
    await bookingsRepo.update(bookingId, {
      completion_otp: otp,
      metadata: {
        ...(booking.metadata || {}),
        serviceCompletionOtp: otp
      }
    });
    
    return sendSuccess(c, { 
      otp, 
      bookingId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      message: "OTP generated successfully"
    });
  } catch (error) {
    console.error("❌ [GENERATE-OTP] Error:", error);
    return sendError(c, error, 500);
  }
});

groomingBookingAPIs.post("/make-server-3dd53475/booking/:bookingId/verify-otp", async (c) => {
  try {
    const bookingId = c.req.param("bookingId");
    const { otp } = await c.req.json();
    
    const bookingsRepo = getBookingsRepository();
    const otpRepo = getOtpRepository();
    
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // Get customer phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(booking.customer_id);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // Verify OTP
    const isValid = await otpRepo.verify(customer.phone, otp, true);
    if (!isValid) {
      return sendError(c, 'Invalid or expired OTP', 400);
    }
    
    // Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: {
        ...(booking.metadata || {}),
        serviceCompletionVerified: true
      }
    });
    
    return sendSuccess(c, { 
      verified: true,
      bookingId,
      message: "Service completed successfully"
    });
  } catch (error) {
    console.error("❌ [VERIFY-OTP] Error:", error);
    return sendError(c, error, 500);
  }
});

export default groomingBookingAPIs;

