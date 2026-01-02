/**
 * ============================================================================
 * GROOMING BOOKING APIs - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Features:
 * - Address management
 * - Wallet operations
 * - Coupon validation
 * - Slot availability
 * - Booking creation with OTP
 * - OTP verification for service completion
 * 
 * KV Operations: 26 → 0
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 */

import { Hono } from "hono";
import { broadcastSlotUpdate } from "./websocket-server";
import { getCustomersRepository } from '../../../supabase/lib/repositories/customers';
import { getAddressesRepository } from '../../../supabase/lib/repositories/addresses';
import { getWalletsRepository } from '../../../supabase/lib/repositories/wallets';
import { getCouponsRepository } from '../../../supabase/lib/repositories/coupons';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings';
import { getVendorsRepository } from '../../../supabase/lib/repositories/vendors';
import { getSchedulingRepository } from '../../../supabase/lib/repositories/scheduling';
import { getDbClient, selectQuery } from '../../../supabase/lib/db';
import { normalizePhone } from './phone-utils';

const groomingBookingAPIs = new Hono();

/**
 * Helper: Get customer by phone, create if doesn't exist
 */
async function getOrCreateCustomerByPhone(phone: string) {
  const cleanPhone = normalizePhone(phone);
  const customersRepo = getCustomersRepository();
  
  // Try to find by phone
  let customer = await customersRepo.findByPhone(cleanPhone);
  
  if (!customer) {
    // Create new customer
    customer = await customersRepo.create({
      phone: cleanPhone,
      customer_id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }
  
  return customer;
}

/**
 * ========================================
 * ADDRESS MANAGEMENT APIs
 * ========================================
 */

// GET /customer/addresses/:phone - Get all addresses for customer
groomingBookingAPIs.get("/customer/addresses/:phone", async (c) => {
  try {
    const phone = c.req.param("phone");
    const cleanPhone = normalizePhone(phone);

    console.log(`\n📍 [GET-ADDRESSES] Fetching addresses for: ${cleanPhone}`);

    // ✅ SQL: Get customer by phone
    const customer = await getOrCreateCustomerByPhone(cleanPhone);
    
    // ✅ SQL: Get addresses
    const addressesRepo = getAddressesRepository();
    const addresses = await addressesRepo.findByCustomer(customer.id);
    
    // Map to expected format
    const formattedAddresses = addresses.map(addr => ({
      id: addr.id,
      label: addr.address_type,
      fullAddress: addr.address_line1 + (addr.address_line2 ? `, ${addr.address_line2}` : ''),
      landmark: addr.landmark || '',
      city: addr.city,
      pincode: addr.pincode,
      state: addr.state,
      isDefault: addr.is_default,
      createdAt: addr.created_at
    }));

    console.log(`✅ [GET-ADDRESSES] Found ${formattedAddresses.length} addresses`);

    return c.json({ addresses: formattedAddresses, count: formattedAddresses.length });
  } catch (error) {
    console.error("❌ [GET-ADDRESSES] Error:", error);
    return c.json({ error: "Failed to fetch addresses", addresses: [] }, 500);
  }
});

// POST /customer/addresses - Add new address
groomingBookingAPIs.post("/customer/addresses", async (c) => {
  try {
    const body = await c.req.json();
    const { phone, label, fullAddress, landmark, city, pincode, state, isDefault } = body;
    const cleanPhone = normalizePhone(phone);

    console.log(`\n📍 [ADD-ADDRESS] Adding address for: ${cleanPhone}`);

    // ✅ SQL: Get or create customer
    const customer = await getOrCreateCustomerByPhone(cleanPhone);
    
    // ✅ SQL: Create address
    const addressesRepo = getAddressesRepository();
    const address = await addressesRepo.create({
      customer_id: customer.id,
      address_type: label === 'work' ? 'work' : label === 'other' ? 'other' : 'home',
      full_name: customer.full_name || customer.phone,
      phone: cleanPhone,
      address_line1: fullAddress,
      city: city,
      state: state || '',
      pincode: pincode,
      landmark: landmark || null,
      is_default: isDefault || false
    });

    console.log(`✅ [ADD-ADDRESS] Address added: ${address.id}`);

    return c.json({ 
      address: {
        id: address.id,
        label: address.address_type,
        fullAddress: address.address_line1,
        landmark: address.landmark || '',
        city: address.city,
        pincode: address.pincode,
        isDefault: address.is_default,
        createdAt: address.created_at
      },
      success: true 
    });
  } catch (error) {
    console.error("❌ [ADD-ADDRESS] Error:", error);
    return c.json({ error: "Failed to add address" }, 500);
  }
});

// DELETE /customer/addresses/:phone/:addressId - Delete address
groomingBookingAPIs.delete("/customer/addresses/:phone/:addressId", async (c) => {
  try {
    const phone = c.req.param("phone");
    const addressId = c.req.param("addressId");
    const cleanPhone = normalizePhone(phone);

    console.log(`\n📍 [DELETE-ADDRESS] Deleting ${addressId} for: ${cleanPhone}`);

    // ✅ SQL: Delete address
    const addressesRepo = getAddressesRepository();
    await addressesRepo.delete(addressId);

    console.log(`✅ [DELETE-ADDRESS] Address deleted`);

    return c.json({ success: true });
  } catch (error) {
    console.error("❌ [DELETE-ADDRESS] Error:", error);
    return c.json({ error: "Failed to delete address" }, 500);
  }
});

/**
 * ========================================
 * WALLET APIs
 * ========================================
 */

// GET /customer/wallet/:phone - Get wallet balance
groomingBookingAPIs.get("/customer/wallet/:phone", async (c) => {
  try {
    const phone = c.req.param("phone");
    const cleanPhone = normalizePhone(phone);

    console.log(`\n💰 [GET-WALLET] Fetching wallet for: ${cleanPhone}`);

    // ✅ SQL: Get or create customer
    const customer = await getOrCreateCustomerByPhone(cleanPhone);
    
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);
    
    // ✅ SQL: Get transactions
    const transactions = await walletsRepo.getTransactionsByCustomer(customer.id, { limit: 50 });

    console.log(`✅ [GET-WALLET] Balance: ₹${wallet.balance}`);

    return c.json({
      balance: wallet.balance,
      transactions: transactions.map(txn => ({
        id: txn.id,
        type: txn.transaction_type,
        amount: txn.amount,
        description: txn.description || '',
        timestamp: txn.created_at,
        bookingId: txn.reference_id || null
      }))
    });
  } catch (error) {
    console.error("❌ [GET-WALLET] Error:", error);
    return c.json({ error: "Failed to fetch wallet", balance: 0, transactions: [] }, 500);
  }
});

// POST /customer/wallet/deduct - Deduct from wallet
groomingBookingAPIs.post("/customer/wallet/deduct", async (c) => {
  try {
    const body = await c.req.json();
    const { phone, amount, bookingId, description } = body;
    const cleanPhone = normalizePhone(phone);

    console.log(`\n💰 [WALLET-DEDUCT] Deducting ₹${amount} for: ${cleanPhone}`);

    // ✅ SQL: Get or create customer
    const customer = await getOrCreateCustomerByPhone(cleanPhone);
    
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);

    if (wallet.balance < amount) {
      return c.json({ error: "Insufficient wallet balance", success: false }, 400);
    }

    // ✅ SQL: Add debit transaction
    await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: customer.id,
      transaction_type: 'debit',
      amount: amount,
      description: description || 'Booking payment',
      reference_id: bookingId || null,
      purpose: 'booking_payment'
    });

    // Get updated wallet
    const updatedWallet = await walletsRepo.findByCustomer(customer.id);

    console.log(`✅ [WALLET-DEDUCT] New balance: ₹${updatedWallet?.balance || 0}`);

    return c.json({ success: true, newBalance: updatedWallet?.balance || 0 });
  } catch (error) {
    console.error("❌ [WALLET-DEDUCT] Error:", error);
    return c.json({ error: "Failed to deduct from wallet" }, 500);
  }
});

// POST /customer/wallet/credit - Add to wallet
groomingBookingAPIs.post("/customer/wallet/credit", async (c) => {
  try {
    const body = await c.req.json();
    const { phone, amount, description } = body;
    const cleanPhone = normalizePhone(phone);

    console.log(`\n💰 [WALLET-CREDIT] Adding ₹${amount} for: ${cleanPhone}`);

    // ✅ SQL: Get or create customer
    const customer = await getOrCreateCustomerByPhone(cleanPhone);
    
    // ✅ SQL: Get or create wallet
    const walletsRepo = getWalletsRepository();
    const wallet = await walletsRepo.findOrCreate(customer.id);

    // ✅ SQL: Add credit transaction
    await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: customer.id,
      transaction_type: 'credit',
      amount: amount,
      description: description || 'Wallet top-up',
      purpose: 'wallet_topup'
    });

    // Get updated wallet
    const updatedWallet = await walletsRepo.findByCustomer(customer.id);

    console.log(`✅ [WALLET-CREDIT] New balance: ₹${updatedWallet?.balance || 0}`);

    return c.json({ success: true, newBalance: updatedWallet?.balance || 0 });
  } catch (error) {
    console.error("❌ [WALLET-CREDIT] Error:", error);
    return c.json({ error: "Failed to credit wallet" }, 500);
  }
});

/**
 * ========================================
 * COUPON APIs
 * ========================================
 */

// POST /coupon/validate - Validate coupon code
groomingBookingAPIs.post("/coupon/validate", async (c) => {
  try {
    const body = await c.req.json();
    const { code, amount, customerId } = body;

    console.log(`\n🎟️ [VALIDATE-COUPON] Validating: ${code}`);

    // ✅ SQL: Validate coupon
    const couponsRepo = getCouponsRepository();
    const result = await couponsRepo.validateCoupon(code, amount, customerId || null);

    if (!result.valid) {
      console.log(`❌ [VALIDATE-COUPON] Invalid coupon: ${code} - ${result.error}`);
      return c.json({ valid: false, error: result.error || "Invalid coupon code" }, 400);
    }

    console.log(`✅ [VALIDATE-COUPON] Valid! Discount: ₹${result.discount_amount}`);

    return c.json({
      valid: true,
      code: result.coupon?.code,
      discount: result.coupon?.discount_type === 'percentage' ? result.coupon?.discount_value : 0,
      discountAmount: result.discount_amount,
      maxDiscount: result.coupon?.max_discount
    });
  } catch (error) {
    console.error("❌ [VALIDATE-COUPON] Error:", error);
    return c.json({ error: "Failed to validate coupon", valid: false }, 500);
  }
});

/**
 * ========================================
 * SLOT AVAILABILITY APIs
 * ========================================
 */

// GET /grooming/slots/:vendorId/:date - Get available slots
groomingBookingAPIs.get("/grooming/slots/:vendorId/:date", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    const date = c.req.param("date");

    console.log(`\n📅 [GET-SLOTS] Fetching slots for vendor: ${vendorId}, date: ${date}`);

    // ✅ SQL: Get vendor
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId) || await vendorsRepo.findByVendorId(vendorId);
    
    if (!vendor) {
      return c.json({ error: "Vendor not found", slots: [] }, 404);
    }

    // ✅ SQL: Get bookings for this date
    const bookingsRepo = getBookingsRepository();
    const dateBookings = await bookingsRepo.findAll({
      vendor_id: vendor.id,
      booking_date: date,
      status: 'confirmed' // Only confirmed bookings count
    });

    // Get day of week
    const bookingDate = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][bookingDate.getDay()];

    // ✅ SQL: Get vendor schedule
    const schedulingRepo = getSchedulingRepository();
    const occupiedSlots = await schedulingRepo.getOccupiedSlots(vendor.id, date);

    // Get vendor availability from metadata or scheduling
    const metadata = (vendor as any).metadata || {};
    const availability = metadata.availability || [];
    
    // Find day configuration
    const dayConfig = Array.isArray(availability) 
      ? availability.find((a: any) => a.dayOfWeek === dayOfWeek)
      : null;

    if (!dayConfig) {
      console.log(`❌ [GET-SLOTS] No availability for ${dayOfWeek}`);
      return c.json({ slots: [], message: "Vendor not available on this day" });
    }

    // Generate slots from time windows
    const slots: any[] = [];
    
    const timeWindows = dayConfig.timeWindows || [];
    for (const window of timeWindows) {
      if (!window.isEnabled) continue;

      const startMinutes = timeToMinutes(window.startTime);
      const endMinutes = timeToMinutes(window.endTime);
      const slotDuration = 30; // 30-minute slots

      for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
        const time = minutesToTime(minutes);
        
        // Count bookings for this slot
        const bookedCount = dateBookings.filter((b: any) => {
          const bookingTime = b.booking_time?.split(' - ')[0] || b.booking_time;
          return bookingTime === time;
        }).length;

        const capacity = window.maxBookings || 3;
        
        slots.push({
          time,
          available: bookedCount < capacity,
          capacity,
          booked: bookedCount,
          period: minutes < 720 ? 'morning' : minutes < 960 ? 'afternoon' : 'evening'
        });
      }
    }

    console.log(`✅ [GET-SLOTS] Generated ${slots.length} slots`);

    return c.json({ slots, date, vendorId });
  } catch (error) {
    console.error("❌ [GET-SLOTS] Error:", error);
    return c.json({ error: "Failed to fetch slots", slots: [] }, 500);
  }
});

/**
 * ========================================
 * BOOKING APIs
 * ========================================
 */

// POST /customer/booking - Create a new booking
groomingBookingAPIs.post("/customer/booking", async (c) => {
  try {
    const bookingData = await c.req.json();
    
    console.log('\n📝 [CREATE-BOOKING] Creating new booking');
    console.log('📝 [CREATE-BOOKING] Data:', bookingData);
    
    // Clean phone number
    const cleanPhone = normalizePhone(bookingData.customerPhone);
    
    // ✅ SQL: Get or create customer
    const customer = await getOrCreateCustomerByPhone(cleanPhone);
    
    // ✅ SQL: Get vendor
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(bookingData.vendorId) || await vendorsRepo.findByVendorId(bookingData.vendorId);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found', success: false }, 404);
    }

    // ✅ SQL: Get pet (from customer metadata or pets table)
    const client = getDbClient();
    const petsResult = await selectQuery<any>("pets", { customer_id: customer.id }, {});
    const pet = petsResult.find((p: any) => p.id === bookingData.petId) || null;
    
    // Generate 4-digit OTP immediately
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = new Date();
    otpExpiresAt.setDate(otpExpiresAt.getDate() + 7); // 7 days expiry
    
    console.log(`🔐 [CREATE-BOOKING] Generated OTP: ${otp}`);
    
    console.log(`📝 [CREATE-BOOKING] Vendor: ${vendor.business_name || 'Unknown'}`);
    console.log(`📝 [CREATE-BOOKING] Pet: ${pet?.name || 'Unknown'}`);
    
    // ✅ SQL: Create booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.create({
      customer_id: customer.id,
      vendor_id: vendor.id,
      staff_id: bookingData.staffId || null,
      service_id: bookingData.serviceId,
      booking_date: bookingData.scheduledDate,
      booking_time: bookingData.scheduledTime,
      service_type: bookingData.serviceStyle || 'at_center',
      address: bookingData.address || null,
      base_price: parseFloat(bookingData.amount),
      total_amount: parseFloat(bookingData.amount),
      payment_status: 'pending',
      status: 'confirmed',
      otp_code: otp,
      otp_expires_at: otpExpiresAt.toISOString(),
      notes: JSON.stringify({
        petId: bookingData.petId || null,
        petName: pet?.name || bookingData.petName || 'Pet',
        petBreed: pet?.breed || null,
        petAge: pet?.age || null,
        petPhoto: pet?.photo || null,
        vendorName: vendor.business_name,
        vendorPhone: vendor.phone,
        serviceName: bookingData.serviceName || 'Grooming Service',
        serviceType: bookingData.serviceType || 'grooming',
        paymentMethod: bookingData.paymentMethod,
        transactionId: bookingData.transactionId || null,
        addOns: bookingData.addOns || [],
        walletUsed: bookingData.walletUsed || 0,
        couponApplied: bookingData.couponApplied || null,
        requiresOTP: true,
        completionOTP: otp,
        otpGeneratedAt: new Date().toISOString(),
        totalSessions: 1,
        completedSessions: 0,
        upcomingSessions: 1
      })
    });
    
    console.log('✅ [CREATE-BOOKING] Saved to booking:' + booking.id);
    
    // ✅ NEW: Broadcast slot update via WebSocket
    if (bookingData.staffId) {
      try {
        broadcastSlotUpdate({
          staffId: bookingData.staffId,
          vendorId: bookingData.vendorId,
          date: bookingData.scheduledDate,
          time: bookingData.scheduledTime,
          action: 'booked',
          bookingId: booking.id,
          customerName: pet?.name || 'Customer',
          serviceName: bookingData.serviceName,
          duration: bookingData.serviceDuration || 30
        });
        console.log('📢 [CREATE-BOOKING] WebSocket update broadcasted');
      } catch (wsError) {
        console.warn('⚠️ [CREATE-BOOKING] Failed to broadcast WebSocket update:', wsError);
        // Don't fail the booking if WebSocket fails
      }
    }
    
    console.log('✅ [CREATE-BOOKING] Booking created successfully:', booking.id);
    
    return c.json({ 
      success: true,
      bookingId: booking.id,
      booking: {
        id: booking.id,
        bookingId: booking.id,
        customerPhone: cleanPhone,
        vendorId: booking.vendor_id,
        serviceId: booking.service_id,
        scheduledDate: booking.booking_date,
        scheduledTime: booking.booking_time,
        status: booking.status,
        amount: booking.total_amount
      },
      otp, // Return OTP in response
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error('❌ [CREATE-BOOKING] Error:', error);
    return c.json({ error: 'Failed to create booking', success: false }, 500);
  }
});

/**
 * ========================================
 * OTP APIs for Service Completion
 * ========================================
 */

// POST /booking/:bookingId/generate-otp - Generate OTP for service completion
groomingBookingAPIs.post("/booking/:bookingId/generate-otp", async (c) => {
  try {
    const bookingId = c.req.param("bookingId");

    console.log(`\n🔐 [GENERATE-OTP] Generating OTP for booking: ${bookingId}`);

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: "Booking not found" }, 404);
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = new Date();
    otpExpiresAt.setHours(otpExpiresAt.getHours() + 1); // 1 hour expiry

    // ✅ SQL: Update booking with OTP
    await bookingsRepo.update(bookingId, {
      otp_code: otp,
      otp_expires_at: otpExpiresAt.toISOString()
    });

    // Update notes with OTP info
    const notes = typeof booking.notes === 'string' ? JSON.parse(booking.notes || '{}') : (booking.notes || {});
    notes.serviceCompletionOtp = otp;
    await bookingsRepo.update(bookingId, {
      notes: JSON.stringify(notes)
    });

    console.log(`✅ [GENERATE-OTP] OTP generated: ${otp}`);

    return c.json({ 
      otp, 
      bookingId,
      expiresAt: otpExpiresAt.toISOString(),
      message: "OTP generated successfully"
    });
  } catch (error) {
    console.error("❌ [GENERATE-OTP] Error:", error);
    return c.json({ error: "Failed to generate OTP" }, 500);
  }
});

// POST /booking/:bookingId/verify-otp - Verify OTP and complete service
groomingBookingAPIs.post("/booking/:bookingId/verify-otp", async (c) => {
  try {
    const bookingId = c.req.param("bookingId");
    const body = await c.req.json();
    const { otp } = body;

    console.log(`\n🔐 [VERIFY-OTP] Verifying OTP for booking: ${bookingId}`);

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: "Booking not found", verified: false }, 404);
    }

    // Check expiry
    if (booking.otp_expires_at && new Date() > new Date(booking.otp_expires_at)) {
      return c.json({ error: "OTP expired", verified: false }, 400);
    }

    // Verify OTP
    if (booking.otp_code !== otp) {
      console.log(`❌ [VERIFY-OTP] Invalid OTP provided`);
      return c.json({ error: "Invalid OTP", verified: false }, 400);
    }

    // ✅ SQL: Update booking status to completed
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      otp_verified: true
    });

    // Update notes
    const notes = typeof booking.notes === 'string' ? JSON.parse(booking.notes || '{}') : (booking.notes || {});
    notes.serviceCompletionVerified = true;
    notes.otpVerifiedAt = new Date().toISOString();
    await bookingsRepo.update(bookingId, {
      notes: JSON.stringify(notes)
    });

    console.log(`✅ [VERIFY-OTP] Booking completed: ${bookingId}`);

    return c.json({ 
      verified: true, 
      bookingCompleted: true,
      completedAt: new Date().toISOString(),
      message: "Service completed successfully"
    });
  } catch (error) {
    console.error("❌ [VERIFY-OTP] Error:", error);
    return c.json({ error: "Failed to verify OTP", verified: false }, 500);
  }
});

// Helper functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export { groomingBookingAPIs };
