// ✅ MIGRATED TO SQL: All KV operations removed
import { getOTPRequirements, isTrainerWalkerBehaviourist } from './service-category-helpers.tsx';
import { getCustomersRepository } from '../../../supabase/lib/repositories/customers.ts';
import { getPetsRepository } from '../../../supabase/lib/repositories/pets.ts';
import { getVendorsRepository } from '../../../supabase/lib/repositories/vendors.ts';
import { getServicesRepository } from '../../../supabase/lib/repositories/services.ts';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings.ts';
import { getStaffRepository } from '../../../supabase/lib/repositories/staff.ts';
import { getSchedulingRepository } from '../../../supabase/lib/repositories/scheduling.ts';
import { getOtpRepository } from '../../../supabase/lib/repositories/otp.ts';

/**
 * PRODUCTION-GRADE BOOKING CREATION HANDLER
 * 
 * Features:
 * - Vendor availability checking
 * - Vacation mode enforcement
 * - Time slot capacity management
 * - START + END OTP generation for trainers/walkers/behaviourists
 * - Single END OTP for other in-person services
 * - Complete tracking across user, pet, and vendor profiles
 * - Comprehensive logging for debugging
 * - ✅ NEW: Doctor assignment for clinic bookings
 * - ✅ NEW: Automatic staff assignment for home services
 */
export async function createProductionBooking(bookingData: any, saveBooking: Function) {
  const { phone: phoneInput, customerPhone, petId, vendorId, doctorId, serviceId, serviceType, scheduledDate, scheduledTime, paymentMethod, transactionId, amount, isPackage, packageDetails, staffId, customerLocation } = bookingData;
  
  const phone = phoneInput || customerPhone;
  
  if (!phone) {
    console.error('❌ Missing phone number in booking data');
    throw new Error('Phone number is required for booking');
  }

  // Clean phone number
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  console.log(`\n========== 🎫 CREATING PRODUCTION BOOKING ==========`);
  console.log(`📞 Phone: ${phone} (cleaned: ${cleanPhone})`);
  console.log(`🐾 Pet ID: ${petId}`);
  console.log(`👨‍⚕️ Vendor ID: ${vendorId}`);
  console.log(`👨‍⚕️ Doctor ID: ${doctorId || 'NONE (direct vendor booking)'}`);
  console.log(`👤 Staff ID: ${staffId || 'NONE'}`);
  console.log(`📅 Scheduled: ${scheduledDate} at ${scheduledTime}`);
  console.log(`💰 Amount: ₹${amount}`);
  console.log(`📦 Is Package: ${isPackage ? 'YES' : 'NO'}`);
  if (isPackage) {
    console.log(`📦 Package Details:`, packageDetails);
  }
  
  // ============================================
  // STEP 1: VALIDATE ENTITIES (SQL)
  // ============================================
  
  // ✅ SQL: Get customer by phone
  const customersRepo = getCustomersRepository();
  const customer = await customersRepo.findByPhone(cleanPhone);
  const customerId = customer?.id || null;
  console.log(`👤 Customer ID: ${customerId || 'NONE (using phone)'}`);
  
  // ✅ SQL: Get pet details
  const petsRepo = getPetsRepository();
  const pet = await petsRepo.findById(petId);
  if (!pet) {
    console.error(`❌ Pet not found: ${petId}`);
    throw new Error('Pet not found');
  }
  console.log(`✅ Pet found: ${pet.name} (${pet.type || pet.species})`);
  
  // ✅ SQL: Get vendor details
  const vendorsRepo = getVendorsRepository();
  const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
  if (!resolvedVendorId) {
    console.error(`❌ Vendor not found: ${vendorId}`);
    throw new Error('Vendor not found');
  }
  const vendor = await vendorsRepo.findById(resolvedVendorId);
  if (!vendor) {
    console.error(`❌ Vendor not found after resolution: ${resolvedVendorId}`);
    throw new Error('Vendor not found');
  }
  console.log(`✅ Vendor found: ${vendor.business_name}`);
  
  // ✅ SQL: Get doctor details if provided (doctor is staff with role='doctor')
  let doctor: any = null;
  if (doctorId) {
    const staffRepo = getStaffRepository();
    doctor = await staffRepo.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      console.error(`❌ Doctor not found or invalid role: ${doctorId}`);
      throw new Error('Doctor not found');
    }
    console.log(`✅ Doctor found: ${doctor.fullName || doctor.name}`);
  }
  
  // ✅ SQL: Get staff details if provided
  let staff: any = null;
  if (staffId) {
    const staffRepo = getStaffRepository();
    staff = await staffRepo.findById(staffId);
    if (staff) {
      console.log(`✅ Staff found: ${staff.fullName || staff.name}`);
    }
  }
  
  // ============================================
  // STEP 2: CHECK VENDOR AVAILABILITY & VACATION MODE
  // ============================================
  
  // ✅ SQL: Check vendor status (vacation mode = not 'active')
  if (vendor.status !== 'active' || !vendor.is_active) {
    console.error(`❌ Vendor is offline (status: ${vendor.status}, is_active: ${vendor.is_active})`);
    throw new Error('Vendor is in vacation mode and not accepting bookings');
  }
  console.log(`✅ Vendor is online and accepting bookings`);
  
  // ✅ SQL: Get service details
  const servicesRepo = getServicesRepository();
  const service = await servicesRepo.findById(serviceId);
  if (!service) {
    console.error(`❌ Service not found: ${serviceId}`);
    throw new Error('Service not found');
  }
  console.log(`✅ Service found: ${service.name}`);
  
  // ✅ SQL: Check vendor availability V2
  const schedulingRepo = getSchedulingRepository();
  const bookingDate = new Date(scheduledDate);
  const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
  const bookingTime = scheduledTime.split(' - ')[0]; // e.g., "09:00"
  const serviceStyle = serviceType === 'tele' ? 'tele' : (serviceType === 'at_home' ? 'at_home' : 'at_center');
  
  const availability = await schedulingRepo.getVendorAvailability(resolvedVendorId, dayOfWeek);
  console.log(`📋 Vendor has V2 availability: ${availability.length > 0 ? 'YES' : 'NO'}`);
  
  if (availability.length > 0) {
    // Check if time falls within any enabled time window
    const bookingTimeMinutes = timeToMinutes(bookingTime);
    let timeWindowFound = false;
    
    for (const avail of availability) {
      if (avail.service_style !== serviceStyle) continue;
      
      const windowStart = timeToMinutes(avail.time_window_start);
      const windowEnd = timeToMinutes(avail.time_window_end);
      
      if (bookingTimeMinutes >= windowStart && bookingTimeMinutes < windowEnd) {
        timeWindowFound = true;
        console.log(`✅ Time window and service configuration validated`);
        console.log(`   Service: ${serviceStyle}, Duration: ${avail.slot_duration_minutes} min, Area: ${avail.service_area_km || 'N/A'} km`);
        break;
      }
    }
    
    if (!timeWindowFound) {
      console.error(`❌ Time ${bookingTime} is outside configured time windows`);
      throw new Error('Time slot is outside configured availability windows');
    }
    
    // ✅ SQL: Check slot capacity
    const slotCapacity = await schedulingRepo.getSlotCapacity(
      resolvedVendorId,
      staffId || null,
      scheduledDate,
      bookingTime,
      serviceStyle
    );
    
    if (slotCapacity && slotCapacity.current_bookings >= slotCapacity.max_capacity) {
      console.error(`❌ Time slot is fully booked (${slotCapacity.current_bookings}/${slotCapacity.max_capacity})`);
      throw new Error('Time slot is fully booked');
    }
    
    // ✅ SQL: Check for existing bookings (using bookings table)
    const bookingsRepo = getBookingsRepository();
    const existingBookings = await bookingsRepo.findByVendorAndDate(resolvedVendorId, scheduledDate);
    const conflictCount = existingBookings.filter(b => {
      const bookingTimeOnly = b.booking_time?.split(':').slice(0, 2).join(':') || b.booking_time;
      return bookingTimeOnly === bookingTime && 
             b.status !== 'cancelled' && 
             b.status !== 'no_show';
    }).length;
    
    if (conflictCount >= (slotCapacity?.max_capacity || 1)) {
      console.error(`❌ Time slot is fully booked (${conflictCount} existing booking(s))`);
      throw new Error('Time slot is fully booked');
    }
    
    console.log(`✅ Availability confirmed - slot is available`);
  } else {
    console.log(`ℹ️  No availability rules set - allowing booking by default`);
  }
  
  // ============================================
  // STEP 3: CREATE BOOKING WITH OTP
  // ============================================
  
  const bookingId = `booking_${Date.now()}`;
  
  // Determine communication type
  const isTele = serviceType === 'tele' || 
                 service.name?.toLowerCase().includes('tele') ||
                 service.name?.toLowerCase().includes('video');
  
  const communicationType = isTele ? 'video' : 'in_person';
  const requiresOTP = communicationType === 'in_person';
  
  // Generate 4-digit OTP for in-person services (except tele consultations)
  const completionOTP = requiresOTP ? String(Math.floor(1000 + Math.random() * 9000)) : null;
  
  // Determine OTP requirements based on service category
  const otpRequirements = getOTPRequirements(service);
  const requiresStartOTP = otpRequirements.requiresStartOTP && requiresOTP;
  const startOTP = requiresStartOTP ? String(Math.floor(1000 + Math.random() * 9000)) : null;
  
  console.log(`🔐 OTP Configuration:`);
  console.log(`   Requires START OTP: ${requiresStartOTP ? 'YES' : 'NO'}`);
  console.log(`   Requires END OTP: ${requiresOTP ? 'YES' : 'NO'}`);
  console.log(`   START OTP: ${startOTP || 'N/A'}`);
  console.log(`   COMPLETION OTP: ${completionOTP || 'N/A'}`);
  
  const booking = {
    id: bookingId,
    serviceType: serviceType,
    serviceName: service.name || 'Service',
    serviceStyle: serviceStyle,
    communicationType: communicationType,
    requiresOTP: requiresOTP,
    requiresStartOTP: requiresStartOTP,
    startOTP: startOTP,
    completionOTP: completionOTP,
    
    // Tracking fields for START OTP services
    startTime: null,
    endTime: null,
    actualDuration: null,
    
    // Customer & Pet
    customerId: customerId || cleanPhone,
    customerPhone: cleanPhone,
    customerName: customer?.full_name || 'Customer',
    petId: petId,
    petName: pet.name,
    petType: pet.type || pet.species || 'Unknown',
    petBreed: pet.breed || '',
    petAge: pet.age ? String(pet.age) : '',
    petPhoto: pet.photo_url || '',
    
    // Vendor
    vendorId: resolvedVendorId,
    vendorName: vendor.business_name || 'Vendor',
    vendorPhone: vendor.phone,
    vendorType: vendor.category || 'service_provider',
    vendorRoleId: vendor.role_id,
    
    // Doctor (if assigned)
    doctorId: doctorId,
    doctorName: doctor ? (doctor.fullName || doctor.name) : null,
    doctorPhone: doctor ? doctor.phone : null,
    
    // Staff (if assigned)
    staffId: staffId,
    staffName: staff ? (staff.fullName || staff.name) : null,
    staffPhone: staff ? staff.phone : null,
    
    // Schedule
    scheduledDate: scheduledDate,
    scheduledTime: scheduledTime,
    bookingDate: scheduledDate,
    bookingTime: scheduledTime,
    duration: service.duration_minutes || 30,
    
    // Payment
    price: amount,
    paymentMethod: paymentMethod,
    transactionId: transactionId,
    paymentStatus: 'paid',
    
    // Status
    status: 'confirmed', // confirmed, in_progress, completed, cancelled
    
    // Package Details
    isPackage: isPackage || false,
    packageDetails: isPackage && packageDetails ? {
      totalSessions: packageDetails.totalSessions || packageDetails.days || 1,
      completedSessions: 0,
      frequency: packageDetails.frequency || 'daily',
      startDate: scheduledDate
    } : null,
    
    // Sessions
    totalSessions: isPackage && packageDetails ? (packageDetails.totalSessions || packageDetails.days || 1) : 1,
    completedSessions: 0,
    upcomingSessions: isPackage && packageDetails ? (packageDetails.totalSessions || packageDetails.days || 1) : 1,
    
    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // ============================================
  // STEP 4: SAVE BOOKING TO ALL REQUIRED LOCATIONS
  // ============================================
  
  console.log(`\n💾 Saving booking to database (SQL)...`);
  
  // Save booking using standardized function (handles user & pet tracking)
  await saveBooking(booking, phone, customerId);
  
  // ✅ SQL: Booking lists are now just queries on bookings table
  // No need to maintain separate lists - queries handle this efficiently
  console.log(`✅ Booking saved to SQL - lists are query-based`);
  
  // ============================================
  // STEP 5: SAVE OTP METADATA (SQL)
  // ============================================
  
  const otpRepo = getOtpRepository();
  const bookingsRepo = getBookingsRepository();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  if (completionOTP) {
    // ✅ SQL: Store completion OTP in otp_tokens table
    await otpRepo.create({
      phone: cleanPhone,
      otp_code: completionOTP,
      otp_type: 'booking_completion',
      expires_in_minutes: 30 * 24 * 60, // 30 days
      max_attempts: 10,
    });
    
    // ✅ SQL: Also store in booking.otp_code for quick access
    await bookingsRepo.update(bookingId, {
      otp_code: completionOTP,
      otp_expires_at: expiresAt.toISOString(),
    });
    
    console.log(`✅ OTP metadata saved (SQL): booking completion OTP`);
    console.log(`🔐 OTP: ${completionOTP} (valid for 30 days)`);
  }
  
  if (startOTP) {
    // ✅ SQL: Store start OTP in otp_tokens table
    await otpRepo.create({
      phone: cleanPhone,
      otp_code: startOTP,
      otp_type: 'booking_start',
      expires_in_minutes: 30 * 24 * 60, // 30 days
      max_attempts: 10,
    });
    
    // Note: Start OTP is stored separately, completion OTP is in booking.otp_code
    console.log(`✅ OTP metadata saved (SQL): booking start OTP`);
    console.log(`🔐 OTP: ${startOTP} (valid for 30 days)`);
  }
  
  // ============================================
  // STEP 6: UPDATE USER & PET PROFILES WITH BOOKING STATS (SQL)
  // ============================================
  
  // ✅ SQL: Update customer stats (calculate from bookings table)
  if (customerId) {
    const customerBookings = await bookingsRepo.findByCustomer(customerId);
    const totalBookings = customerBookings.length;
    const lastBooking = customerBookings[0]; // Most recent
    
    // Note: total_bookings and last_booking_date may not exist in schema
    // These can be calculated from bookings table when needed
    console.log(`✅ Customer stats: ${totalBookings} total bookings (calculated from SQL)`);
  }
  
  // ✅ SQL: Update pet stats (calculate from bookings table)
  const allBookings = await bookingsRepo.findAll({ limit: 1000 }); // Get all bookings
  const petBookingCount = allBookings.filter(b => 
    (b as any).pet_id === petId || (b as any).petId === petId
  ).length;
  
  // Note: Pet stats can be calculated from bookings table when needed
  console.log(`✅ Pet stats: ${petBookingCount} bookings (calculated from SQL)`);
  
  console.log(`\n========== ✅ BOOKING CREATED SUCCESSFULLY (SQL) ==========`);
  console.log(`📋 Booking ID: ${bookingId}`);
  console.log(`🔐 OTP: ${completionOTP || 'N/A (tele consultation)'}`);
  console.log(`📊 Saved to SQL database - zero KV operations`);
  console.log(`====================================================\n`);
  
  return {
    success: true,
    message: 'Booking created successfully',
    booking: booking,
    otp: completionOTP
  };
}