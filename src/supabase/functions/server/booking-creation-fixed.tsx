/**
 * ============================================================================
 * FIXED BOOKING CREATION - SQL ONLY, NO KV STORE
 * ============================================================================
 * 
 * Replaces: booking-creation.tsx
 * Fixes: All 23 violations from scheduling audit
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getSchedulingService } from "../../../lib/services/scheduling-service";
import { getBookingsRepository } from "../../../lib/repositories/bookings";
import type { CreateBookingInput } from "../../../lib/repositories/bookings";

/**
 * PRODUCTION-GRADE BOOKING CREATION HANDLER
 * 
 * Features:
 * - ✅ FIX V23: Atomic distributed locking
 * - ✅ FIX V1: Configurable capacity
 * - ✅ FIX V2: Atomic slot reservation
 * - ✅ FIX V3: Standardized status filtering
 * - ✅ FIX V5: Travel time validation
 * - ✅ FIX V7: Distance validation
 * - ✅ FIX V10-V11: Commute time validation
 * - ✅ FIX V12: Buffer time validation
 * - ✅ All validations in single atomic operation
 */
export async function createProductionBooking(bookingData: any, saveBooking: Function) {
    const {
        phone: phoneInput,
        customerPhone,
        petId,
        vendorId,
        doctorId,
        serviceId,
        serviceType,
        scheduledDate,
        scheduledTime,
        paymentMethod,
        transactionId,
        amount,
        isPackage,
        packageDetails,
        staffId,
        customerLocation
    } = bookingData;

    const phone = phoneInput || customerPhone;

    if (!phone) {
        console.error('❌ Missing phone number in booking data');
        throw new Error('Phone number is required for booking');
    }

    // Clean phone number
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    console.log(`\n========== 🎫 CREATING PRODUCTION BOOKING (FIXED) ==========`);
    console.log(`📞 Phone: ${phone} (cleaned: ${cleanPhone})`);
    console.log(`🐾 Pet ID: ${petId}`);
    console.log(`👨‍⚕️ Vendor ID: ${vendorId}`);
    console.log(`👨‍⚕️ Doctor ID: ${doctorId || 'NONE'}`);
    console.log(`👤 Staff ID: ${staffId || 'NONE'}`);
    console.log(`📅 Scheduled: ${scheduledDate} at ${scheduledTime}`);
    console.log(`💰 Amount: ₹${amount}`);

    // ============================================
    // STEP 1: VALIDATE ENTITIES (SQL)
    // ============================================

    const { getDbClient } = await import("../../../lib/db.ts");
    const db = getDbClient();

    // Get customer ID
    const { data: customerData } = await db
        .from("customers")
        .select("id")
        .eq("phone", cleanPhone)
        .single();

    const customerId = customerData?.id;
    console.log(`👤 Customer ID: ${customerId || 'NONE (using phone)'}`);

    // Get pet details
    const { data: petData } = await db
        .from("pets")
        .select("*")
        .eq("id", petId)
        .single();

    if (!petData) {
        console.error(`❌ Pet not found: ${petId}`);
        throw new Error('Pet not found');
    }
    console.log(`✅ Pet found: ${petData.name} (${petData.species})`);

    // Get vendor details
    const { data: vendorData } = await db
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .single();

    if (!vendorData) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        throw new Error('Vendor not found');
    }
    console.log(`✅ Vendor found: ${vendorData.business_name || vendorData.name}`);

    // Get service details
    const { data: serviceData } = await db
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .single();

    if (!serviceData) {
        console.error(`❌ Service not found: ${serviceId}`);
        throw new Error('Service not found');
    }
    console.log(`✅ Service found: ${serviceData.name}`);

    // ============================================
    // STEP 2: CREATE BOOKING WITH ALL VALIDATIONS
    // ============================================

    const schedulingService = getSchedulingService();
    const requestId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Prepare booking input
    const bookingInput: CreateBookingInput = {
        customer_id: customerId || cleanPhone,
        vendor_id: vendorId,
        staff_id: staffId || doctorId || null,
        service_id: serviceId,
        booking_date: scheduledDate,
        booking_time: scheduledTime.split(' - ')[0], // Extract start time
        service_type: serviceType || serviceData.service_style || 'at_center',
        address: customerLocation?.address,
        city: customerLocation?.city,
        state: customerLocation?.state,
        pincode: customerLocation?.pincode,
        latitude: customerLocation?.latitude || customerLocation?.lat,
        longitude: customerLocation?.longitude || customerLocation?.lng,
        base_price: amount || serviceData.price || 0,
        total_amount: amount || serviceData.price || 0,
        is_package: isPackage || false,
        package_id: packageDetails?.packageId,
        package_details: packageDetails,
        notes: bookingData.notes || bookingData.specialInstructions
    };

    // Create booking with all validations (FIXES ALL VIOLATIONS)
    const result = await schedulingService.createBookingWithValidation(
        bookingInput,
        requestId
    );

    if (!result.success) {
        console.error(`❌ Booking validation failed: ${result.error}`);
        throw new Error(result.error || 'Booking validation failed');
    }

    const booking = result.booking!;
    console.log(`✅ Booking created successfully: ${booking.id}`);

    // ============================================
    // STEP 3: GENERATE OTP IF NEEDED
    // ============================================

    const isTele = bookingInput.service_type === 'tele' ||
        serviceData.name?.toLowerCase().includes('tele') ||
        serviceData.name?.toLowerCase().includes('video');

    if (!isTele) {
        const otpCode = String(Math.floor(1000 + Math.random() * 9000));
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        await getBookingsRepository().setOtp(booking.id, otpCode, 30);
        console.log(`🔐 OTP generated: ${otpCode}`);
    }

    // ============================================
    // STEP 4: RETURN RESULT
    // ============================================

    console.log(`\n========== ✅ BOOKING CREATED SUCCESSFULLY ==========`);
    console.log(`📋 Booking ID: ${booking.id}`);
    console.log(`🔐 OTP: ${isTele ? 'N/A (tele consultation)' : 'Generated'}`);
    console.log(`📊 All validations passed`);
    console.log(`====================================================\n`);

    return {
        success: true,
        message: 'Booking created successfully',
        booking: booking,
        otp: isTele ? null : (await getBookingsRepository().findById(booking.id))?.otp_code
    };
}

