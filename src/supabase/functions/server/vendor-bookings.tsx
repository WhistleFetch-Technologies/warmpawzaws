// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// Vendor booking management endpoints
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import {
  getBookingsRepository,
  getCustomersRepository
} from '../../../supabase/lib/repositories/index';

const app = new Hono();

/**
 * GET /make-server-3dd53475/vendor/bookings/:vendorId
 * Get all bookings for a vendor
 * Query params:
 *  - date: filter by date (YYYY-MM-DD)
 *  - filter: all|confirmed|pending|completed|cancelled
 */
app.get("/make-server-3dd53475/vendor/bookings/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const date = c.req.query('date');
    const filter = c.req.query('filter') || 'all';
    
    console.log(`📋 [VENDOR-BOOKINGS] Fetching bookings for vendor: ${vendorId}`);
    console.log(`   Filters: date=${date}, status=${filter}`);
    
    // ✅ SQL: Get all bookings for vendor
    const bookingsRepo = getBookingsRepository();
    const allBookings = await bookingsRepo.findByVendor(vendorId);
    
    console.log(`   Found ${allBookings.length} bookings for vendor`);
    
    // Map to expected format and add chat flags
    const bookings = allBookings.map((booking: any) => {
      // ✅ ADD: Ensure chatEnabled is always true (unless cancelled)
      return {
        ...booking,
        chatEnabled: booking.status !== 'cancelled',
        hasUnreadMessages: booking.has_unread_messages || false,
        unreadMessageCount: booking.unread_message_count || 0,
        isFollowUp: booking.is_follow_up || false,
        hasPrescription: booking.has_prescription || false,
        // Map SQL field names to expected format
        serviceName: booking.service_name || booking.serviceName,
        scheduledDate: booking.booking_date || booking.scheduled_date || booking.scheduledDate,
        date: booking.booking_date || booking.date,
        bookingDate: booking.booking_date || booking.bookingDate,
        createdAt: booking.created_at || booking.createdAt
      };
    });
    
    // Apply filters
    let filteredBookings = bookings;
    
    console.log(`   📊 Before filtering: ${bookings.length} bookings`);
    
    // Filter by date
    if (date) {
      console.log(`   🔍 Filtering by date: ${date}`);
      filteredBookings = filteredBookings.filter((b: any) => {
        const bookingDate = b.scheduledDate || b.date || b.bookingDate;
        return bookingDate && bookingDate.startsWith(date);
      });
      console.log(`   After date filter: ${filteredBookings.length} bookings`);
    }
    
    // Filter by status
    if (filter && filter !== 'all') {
      filteredBookings = filteredBookings.filter((b: any) => 
        b.status?.toLowerCase() === filter.toLowerCase()
      );
      console.log(`   After status filter: ${filteredBookings.length} bookings`);
    }
    
    // Sort by date and time (newest first)
    filteredBookings.sort((a: any, b: any) => {
      const dateA = new Date(a.scheduledDate || a.date || a.bookingDate || a.createdAt);
      const dateB = new Date(b.scheduledDate || b.date || b.bookingDate || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log(`✅ [VENDOR-BOOKINGS] Returning ${filteredBookings.length} bookings`);
    
    return c.json({
      success: true,
      bookings: filteredBookings,
      total: filteredBookings.length,
      filters: {
        date,
        status: filter
      }
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-BOOKINGS] Error fetching bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/bookings/:bookingId/cancel
 * Cancel a booking
 */
app.post("/make-server-3dd53475/vendor/bookings/:bookingId/cancel", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { reason } = await c.req.json();
    
    console.log(`❌ [VENDOR-BOOKINGS] Cancelling booking: ${bookingId}`);
    
    // ✅ SQL: Get and update booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'vendor',
      cancellation_reason: reason || 'Cancelled by vendor',
      updated_at: new Date().toISOString()
    });
    
    const updatedBooking = await bookingsRepo.findById(bookingId);
    
    console.log(`✅ [VENDOR-BOOKINGS] Booking cancelled: ${bookingId}`);
    
    return c.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking cancelled successfully'
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-BOOKINGS] Error cancelling booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/bookings/:bookingId/complete
 * Mark a booking as completed
 */
app.post("/make-server-3dd53475/vendor/bookings/:bookingId/complete", async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`✅ [VENDOR-BOOKINGS] Completing booking: ${bookingId}`);
    
    // ✅ SQL: Get and update booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    const updatedBooking = await bookingsRepo.findById(bookingId);
    
    console.log(`✅ [VENDOR-BOOKINGS] Booking completed: ${bookingId}`);
    
    return c.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking marked as completed'
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-BOOKINGS] Error completing booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vendor/customer-history/:customerPhone
 * Get customer's booking history (for displaying in chat)
 */
app.get("/make-server-3dd53475/vendor/customer-history/:customerPhone", async (c) => {
  try {
    const { customerPhone } = c.req.param();
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    
    console.log(`📜 [VENDOR] Fetching customer history for: ${cleanPhone}`);
    
    // ✅ SQL: Get customer by phone and their bookings
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        history: [],
        total: 0
      });
    }
    
    // ✅ SQL: Get customer bookings
    const bookingsRepo = getBookingsRepository();
    const customerBookings = await bookingsRepo.findByCustomer(customer.id);
    
    const history = customerBookings.map((booking: any) => ({
      id: booking.id,
      serviceName: booking.service_name || booking.serviceName,
      serviceType: booking.service_type || booking.serviceType,
      vendorName: booking.vendor_name || booking.vendorName,
      petName: booking.pet_name || booking.petName,
      status: booking.status,
      selectedDate: booking.booking_date || booking.selected_date || booking.selectedDate,
      selectedTime: booking.booking_time || booking.selected_time || booking.selectedTime,
      createdAt: booking.created_at || booking.createdAt,
      completedAt: booking.completed_at || booking.otp_verified_at || booking.completedAt
    }));
    
    // Sort by date (newest first)
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`✅ [VENDOR] Found ${history.length} bookings for customer: ${cleanPhone}`);
    
    return c.json({
      success: true,
      history,
      total: history.length
    });
    
  } catch (error) {
    console.error('❌ [VENDOR] Error fetching customer history:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;