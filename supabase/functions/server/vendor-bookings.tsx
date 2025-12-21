// Vendor booking management endpoints
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

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
    
    // Get vendor's booking IDs
    const vendorBookingsKey = `vendor:bookings:${vendorId}`;
    console.log(`   Looking up key: ${vendorBookingsKey}`);
    
    const bookingIds = await kv.get(vendorBookingsKey) || [];
    
    console.log(`   Found ${bookingIds.length} booking IDs:`, bookingIds);
    
    if (bookingIds.length === 0) {
      console.log(`   ⚠️ No booking IDs found in key: ${vendorBookingsKey}`);
      
      // DEBUG: Try to list all vendor booking data to see what exists
      const allVendorBookingData = await kv.getByPrefix('vendor:bookings:');
      console.log(`   📊 Total vendor booking lists in system: ${allVendorBookingData.length}`);
      if (allVendorBookingData.length > 0) {
        console.log(`   Sample booking lists:`, allVendorBookingData.slice(0, 3));
      }
      
      // DEBUG: Also check if there are any bookings at all
      const allBookings = await kv.getByPrefix('booking:BK_');
      console.log(`   📊 Total bookings in system: ${allBookings.length}`);
      if (allBookings.length > 0) {
        const sampleBooking = allBookings[0];
        console.log(`   Sample booking vendorId:`, sampleBooking?.vendorId);
      }
      
      return c.json({ 
        success: true, 
        bookings: [],
        total: 0,
        debug: {
          vendorId,
          keySearched: vendorBookingsKey,
          totalVendorBookingLists: allVendorBookingData.length,
          totalBookingsInSystem: allBookings.length
        },
        message: 'No bookings found'
      });
    }
    
    // Fetch full booking details
    const bookings = [];
    const missingBookings = [];
    for (const bookingId of bookingIds) {
      console.log(`   🔍 Fetching booking: ${bookingId}`);
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        console.log(`      ✅ Found booking: ${booking.serviceName || booking.id}`);
        
        // ✅ ADD: Ensure chatEnabled is always true (unless cancelled)
        booking.chatEnabled = booking.status !== 'cancelled';
        booking.hasUnreadMessages = booking.hasUnreadMessages || false;
        booking.unreadMessageCount = booking.unreadMessageCount || 0;
        booking.isFollowUp = booking.isFollowUp || false;
        booking.hasPrescription = booking.hasPrescription || false;
        
        bookings.push(booking);
      } else {
        console.log(`      ❌ Missing booking: ${bookingId}`);
        missingBookings.push(bookingId);
      }
    }
    
    console.log(`   Loaded ${bookings.length} complete bookings out of ${bookingIds.length} IDs`);
    if (missingBookings.length > 0) {
      console.log(`   ⚠️ Missing ${missingBookings.length} bookings:`, missingBookings);
    }
    
    // Apply filters
    let filteredBookings = bookings;
    
    console.log(`   📊 Before filtering: ${bookings.length} bookings`);
    if (bookings.length > 0) {
      console.log(`   Sample booking dates:`, bookings.slice(0, 3).map((b: any) => ({
        id: b.id,
        scheduledDate: b.scheduledDate,
        date: b.date,
        bookingDate: b.bookingDate
      })));
    }
    
    // Filter by date
    if (date) {
      console.log(`   🔍 Filtering by date: ${date}`);
      filteredBookings = filteredBookings.filter((b: any) => 
        b.scheduledDate === date || b.date === date || b.bookingDate === date
      );
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
      },
      debug: {
        vendorId,
        keySearched: vendorBookingsKey,
        totalBookingIds: bookingIds.length,
        loadedBookings: bookings.length,
        missingBookings: missingBookings.length,
        missingBookingIds: missingBookings,
        bookingIds: bookingIds
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
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    booking.cancelledBy = 'vendor';
    booking.cancellationReason = reason || 'Cancelled by vendor';
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ [VENDOR-BOOKINGS] Booking cancelled: ${bookingId}`);
    
    return c.json({
      success: true,
      booking,
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
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ [VENDOR-BOOKINGS] Booking completed: ${bookingId}`);
    
    return c.json({
      success: true,
      booking,
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
    
    // Get customer's bookings
    const customerBookingsKey = `customer:bookings:${cleanPhone}`;
    const bookingIds = await kv.get(customerBookingsKey) || [];
    
    const history = [];
    
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        history.push({
          id: booking.id,
          serviceName: booking.serviceName,
          serviceType: booking.serviceType,
          vendorName: booking.vendorName,
          petName: booking.petName,
          status: booking.status,
          selectedDate: booking.selectedDate,
          selectedTime: booking.selectedTime,
          createdAt: booking.createdAt,
          completedAt: booking.otpVerifiedAt || booking.completedAt
        });
      }
    }
    
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