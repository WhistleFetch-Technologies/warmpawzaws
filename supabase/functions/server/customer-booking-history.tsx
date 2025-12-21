// Customer booking history endpoints
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

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
    
    // Get customer's booking list
    const customerBookingsKey = `customer:bookings:${cleanPhone}`;
    const bookingIds = await kv.get(customerBookingsKey) || [];
    
    console.log(`   Found ${bookingIds.length} booking IDs`);
    
    if (bookingIds.length === 0) {
      return c.json({
        success: true,
        bookings: [],
        total: 0,
        message: 'No bookings found'
      });
    }
    
    // Fetch all booking details
    const bookings = [];
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        bookings.push(booking);
      }
    }
    
    // Sort by date (newest first)
    bookings.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.scheduledDate).getTime();
      const dateB = new Date(b.createdAt || b.scheduledDate).getTime();
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
    
    // Get customer's booking list
    const customerBookingsKey = `customer:bookings:${cleanPhone}`;
    const bookingIds = await kv.get(customerBookingsKey) || [];
    
    if (bookingIds.length === 0) {
      return c.json({
        success: true,
        bookings: [],
        total: 0
      });
    }
    
    // Fetch all bookings and filter for eligible ones
    const eligibleBookings = [];
    const now = new Date();
    
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking || booking.status !== 'completed') {
        continue;
      }
      
      // Check if within 7-day window
      const completedDate = booking.otpVerifiedAt || booking.completedAt;
      if (!completedDate) {
        continue;
      }
      
      const completed = new Date(completedDate);
      const daysSinceCompletion = Math.floor((now.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceCompletion < 0 || daysSinceCompletion > 7) {
        continue;
      }
      
      // Check if follow-up already booked
      const existingFollowup = await kv.get(`booking:${bookingId}:followup`);
      if (existingFollowup) {
        continue;
      }
      
      // Fetch vendor details to get vendor phone
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      
      // Try to get vendor phone from vendor object first
      let vendorPhone = vendor?.phone || vendor?.mobile || vendor?.phoneNumber || vendor?.contactNumber || null;
      
      // Always try to extract phone from vendorId as fallback
      if (!vendorPhone && booking.vendorId) {
        if (booking.vendorId.startsWith('vendor_')) {
          const phoneFromId = booking.vendorId.replace('vendor_', '');
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
      console.log(`   Vendor ID: ${booking.vendorId}`);
      console.log(`   Vendor found in DB: ${!!vendor}`);
      console.log(`   Final vendor phone: ${vendorPhone || 'NULL'}`);
      
      if (!vendorPhone) {
        console.log(`❌ No vendor phone available for booking:`, {
          bookingId: booking.id,
          vendorId: booking.vendorId,
          vendorName: booking.vendorName,
          vendorObjectKeys: vendor ? Object.keys(vendor) : 'vendor_not_found'
        });
      }
      
      // Check for prescription
      const prescriptionId = booking.prescriptionId || null;
      let prescription = null;
      if (prescriptionId) {
        prescription = await kv.get(`prescription:${prescriptionId}`);
      }
      
      eligibleBookings.push({
        bookingId: booking.id,
        serviceName: booking.serviceName,
        serviceType: booking.serviceType,
        serviceStyle: booking.serviceStyle || booking.serviceType,
        vendorId: booking.vendorId,
        vendorName: booking.vendorName,
        vendorPhone: vendorPhone,
        customerPhone: booking.customerPhone,
        customerName: booking.customerName,
        petId: booking.petId,
        petName: booking.petName,
        scheduledDate: booking.scheduledDate || booking.bookingDate,
        scheduledTime: booking.scheduledTime || booking.bookingTime,
        completedAt: completedDate,
        completedDate: completedDate,
        daysAgo: daysSinceCompletion,
        daysRemaining: 7 - daysSinceCompletion,
        hasPrescription: !!prescription,
        prescriptionUrl: prescription?.prescriptionUrl || null,
        prescriptionId: prescriptionId,
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
    
    // Get customer's booking list
    const customerBookingsKey = `customer:bookings:${cleanPhone}`;
    const bookingIds = await kv.get(customerBookingsKey) || [];
    
    console.log(`   Found ${bookingIds.length} total customer bookings`);
    
    if (bookingIds.length === 0) {
      return c.json({
        success: true,
        bookings: [],
        total: 0,
        message: 'No bookings found'
      });
    }
    
    // Fetch booking details and filter by petId
    const petBookings = [];
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.petId === petId) {
        petBookings.push(booking);
      }
    }
    
    // Sort by date (newest first)
    petBookings.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.scheduledDate).getTime();
      const dateB = new Date(b.createdAt || b.scheduledDate).getTime();
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
    
    const booking = await kv.get(`booking:${bookingId}`);
    
    if (!booking) {
      console.log(`❌ Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    console.log(`✅ [BOOKING-DETAIL] Found booking: ${booking.serviceName}`);
    
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
