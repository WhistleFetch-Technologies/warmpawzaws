// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// Customer booking history endpoints
import { Hono } from 'hono';
import {
  getBookingsRepository,
  getVendorsRepository,
  getPrescriptionsRepository,
  getCustomersRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

export function registerCustomerBookingHistory(app: Hono) {

/**
 * GET /make-server-3dd53475/customer/bookings/history/:phone
 * Get all bookings for a customer by phone number
 */
app.get("/make-server-3dd53475/customer/bookings/history/:phone", async (c) => {
  try {
    const { phone } = c.req.param();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    console.log(`📚 [BOOKING-HISTORY] Fetching bookings for customer: ${cleanPhone}`);
    
    // ✅ SQL: Get customer and their bookings from bookings table
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: [],
        total: 0,
        message: 'No bookings found'
      });
    }
    
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByCustomer(customer.id);
    
    console.log(`   Found ${bookings.length} bookings`);
    
    // Sort by date (newest first) - already sorted by repository if needed
    bookings.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booking_date).getTime();
      const dateB = new Date(b.created_at || b.booking_date).getTime();
      return dateB - dateA;
    });
    
    console.log(`✅ [BOOKING-HISTORY] Returning ${bookings.length} bookings`);
    
    // Group by status for statistics
    const stats = {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      inProgress: bookings.filter(b => b.status === 'in_progress').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
    };
    
    return c.json({
      success: true,
      bookings,
      stats,
      total: bookings.length
    });
    
  } catch (error) {
    console.error('❌ [BOOKING-HISTORY] Error fetching customer bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/bookings/follow-up-eligible/:phone
 * Get bookings eligible for follow-up (completed within 7 days)
 */
app.get("/make-server-3dd53475/customer/bookings/follow-up-eligible/:phone", async (c) => {
  try {
    const { phone } = c.req.param();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    console.log(`🔄 [FOLLOW-UP-ELIGIBLE] Checking follow-up eligible bookings for: ${cleanPhone}`);
    
    // ✅ SQL: Get customer and their bookings from bookings table
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: [],
        total: 0
      });
    }
    
    const bookingsRepo = getBookingsRepository();
    const allBookings = await bookingsRepo.findByCustomer(customer.id);
    
    // Fetch all bookings and filter for eligible ones
    const eligibleBookings = [];
    const now = new Date();
    
    for (const booking of allBookings) {
      
      if (!booking || booking.status !== 'completed') {
        continue;
      }
      
      // Check if within 7-day window
      const completedDate = booking.completed_at || booking.otp_verified_at;
      if (!completedDate) {
        continue;
      }
      
      const completed = new Date(completedDate);
      const daysSinceCompletion = Math.floor((now.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceCompletion < 0 || daysSinceCompletion > 7) {
        continue;
      }
      
      // ✅ SQL: Check if follow-up already booked in bookings table
      const db = getDbClient();
      const { data: existingFollowup } = await db
        .from('bookings')
        .select('id')
        .eq('customer_id', booking.customer_id)
        .eq('follow_up_booking_id', booking.id)
        .single();
      
      if (existingFollowup) {
        continue;
      }
      
      // ✅ SQL: Fetch vendor details to get vendor phone
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(booking.vendor_id || '');
      
      // Try to get vendor phone from vendor object first
      let vendorPhone = vendor?.phone || vendor?.mobile || vendor?.contact_number || null;
      
      // Always try to extract phone from vendorId as fallback
      if (!vendorPhone && booking.vendor_id) {
        if (booking.vendor_id.startsWith('vendor_')) {
          const phoneFromId = booking.vendor_id.replace('vendor_', '');
          // Remove any non-digit characters just in case
          const digitsOnly = phoneFromId.replace(/\D/g, '');
          if (digitsOnly.length === 10) {
            vendorPhone = digitsOnly;
            console.log(`📞 [FOLLOW-UP] Extracted vendor phone from vendorId: ${vendorPhone}`);
          }
        }
      }
      
      // Debug logging
      console.log(`📋 [FOLLOW-UP] Processing booking: ${booking.id}`);
      console.log(`   Vendor ID: ${booking.vendor_id}`);
      console.log(`   Vendor found in DB: ${!!vendor}`);
      console.log(`   Final vendor phone: ${vendorPhone || 'NULL'}`);
      
      if (!vendorPhone) {
        console.log(`❌ No vendor phone available for booking:`, {
          bookingId: booking.id,
          vendorId: booking.vendor_id,
          vendorName: booking.vendor_name,
          vendorObjectKeys: vendor ? Object.keys(vendor) : 'vendor_not_found'
        });
      }
      
      // ✅ SQL: Check for prescription from prescriptions table
      const prescriptionsRepo = getPrescriptionsRepository();
      let prescription = null;
      if (booking.prescription_id) {
        prescription = await prescriptionsRepo.findById(booking.prescription_id);
      }
      
      eligibleBookings.push({
        bookingId: booking.id,
        serviceName: booking.service_name || booking.serviceName,
        serviceType: booking.service_type || booking.serviceType,
        serviceStyle: booking.service_style || booking.serviceStyle || booking.service_type,
        vendorId: booking.vendor_id || booking.vendorId,
        vendorName: booking.vendor_name || booking.vendorName,
        vendorPhone: vendorPhone,
        customerPhone: booking.customer_phone || booking.customerPhone,
        customerName: booking.customer_name || booking.customerName,
        petId: booking.pet_id || booking.petId,
        petName: booking.pet_name || booking.petName,
        scheduledDate: booking.booking_date || booking.scheduledDate,
        scheduledTime: booking.booking_time || booking.scheduledTime,
        completedAt: completedDate,
        completedDate: completedDate,
        daysAgo: daysSinceCompletion,
        daysRemaining: 7 - daysSinceCompletion,
        hasPrescription: !!prescription,
        prescriptionUrl: prescription?.prescription_file_url || prescription?.prescriptionUrl || null,
        prescriptionId: booking.prescription_id || null,
        prescriptionNotes: prescription?.notes || null
      });
    }
    
    // Sort by completion date (most recent first)
    eligibleBookings.sort((a, b) => {
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
    
    console.log(`✅ [FOLLOW-UP-ELIGIBLE] Found ${eligibleBookings.length} eligible bookings`);
    
    return c.json({
      success: true,
      bookings: eligibleBookings,
      total: eligibleBookings.length
    });
    
  } catch (error) {
    console.error('❌ [FOLLOW-UP-ELIGIBLE] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/bookings/pet/:phone/:petId
 * Get all bookings for a specific pet
 */
app.get("/make-server-3dd53475/customer/bookings/pet/:phone/:petId", async (c) => {
  try {
    const { phone, petId } = c.req.param();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    console.log(`🐾 [PET-BOOKING-HISTORY] Fetching bookings for pet: ${petId}`);
    
    // ✅ SQL: Get customer and their bookings filtered by pet from bookings table
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: [],
        total: 0,
        message: 'No bookings found'
      });
    }
    
    const bookingsRepo = getBookingsRepository();
    const allBookings = await bookingsRepo.findByCustomer(customer.id);
    
    // Filter by petId
    const petBookings = allBookings.filter(booking => 
      (booking.pet_id || booking.petId) === petId
    );
    
    console.log(`   Found ${petBookings.length} bookings for pet ${petId}`);
    
    // Sort by date (newest first)
    petBookings.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booking_date).getTime();
      const dateB = new Date(b.created_at || b.booking_date).getTime();
      return dateB - dateA;
    });
    
    console.log(`✅ [PET-BOOKING-HISTORY] Returning ${petBookings.length} bookings for pet ${petId}`);
    
    // Group by status
    const stats = {
      total: petBookings.length,
      confirmed: petBookings.filter(b => b.status === 'confirmed').length,
      inProgress: petBookings.filter(b => b.status === 'in_progress').length,
      completed: petBookings.filter(b => b.status === 'completed').length,
      cancelled: petBookings.filter(b => b.status === 'cancelled').length,
    };
    
    return c.json({
      success: true,
      bookings: petBookings,
      stats,
      total: petBookings.length
    });
    
  } catch (error) {
    console.error('❌ [PET-BOOKING-HISTORY] Error fetching pet bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/bookings/:bookingId
 * Get detailed information for a specific booking
 */
app.get("/make-server-3dd53475/customer/bookings/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`🔍 [BOOKING-DETAIL] Fetching booking: ${bookingId}`);
    
    // ✅ SQL: Get booking from bookings table
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      console.log(`❌ Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    console.log(`✅ [BOOKING-DETAIL] Found booking: ${booking.service_name || booking.serviceName}`);
    
    return c.json({
      success: true,
      booking
    });
    
  } catch (error) {
    console.error('❌ [BOOKING-DETAIL] Error fetching booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});


}
