/**
 * VENDOR BOOKING MANAGEMENT ENDPOINTS - SQL VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL repositories
 * 
 * Features:
 * - Get all bookings for a vendor
 * - Cancel bookings
 * - Complete bookings
 * - Customer booking history
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (10 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';

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
    
    console.log(`📋 [VENDOR-BOOKINGS-SQL] Fetching bookings for vendor: ${vendorId}`);
    console.log(`   Filters: date=${date}, status=${filter}`);
    
    // ✅ SQL: Get all bookings for vendor
    const bookingsRepo = getBookingsRepository();
    let bookings = await bookingsRepo.findByVendor(vendorId);
    
    console.log(`   Found ${bookings.length} bookings from SQL`);
    
    if (bookings.length === 0) {
      return c.json({ 
        success: true, 
        bookings: [],
        total: 0,
        filters: { date, status: filter },
        message: 'No bookings found'
      });
    }
    
    // Transform SQL bookings to expected format
    const transformedBookings = bookings.map((b: any) => ({
      id: b.id,
      bookingId: b.booking_id || b.id,
      customerId: b.customer_id,
      vendorId: b.vendor_id,
      staffId: b.staff_id,
      serviceId: b.service_id,
      serviceName: b.service_name || 'Service',
      serviceType: b.service_type,
      scheduledDate: b.booking_date,
      date: b.booking_date,
      bookingDate: b.booking_date,
      bookingTime: b.booking_time,
      time: b.booking_time,
      status: b.status,
      paymentStatus: b.payment_status,
      totalAmount: b.total_amount,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      completedAt: b.completed_at,
      cancelledAt: b.cancelled_at,
      cancellationReason: b.cancellation_reason,
      chatEnabled: b.status !== 'cancelled',
      hasUnreadMessages: false,
      unreadMessageCount: 0,
      isFollowUp: false,
      hasPrescription: false
    }));
    
    // Apply filters
    let filteredBookings = transformedBookings;
    
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
    
    console.log(`✅ [VENDOR-BOOKINGS-SQL] Returning ${filteredBookings.length} bookings`);
    
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
    console.error('❌ [VENDOR-BOOKINGS-SQL] Error fetching bookings:', error);
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
    
    console.log(`❌ [VENDOR-BOOKINGS-SQL] Cancelling booking: ${bookingId}`);
    
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || 'Cancelled by vendor'
    });
    
    const updatedBooking = await bookingsRepo.findById(bookingId);
    
    console.log(`✅ [VENDOR-BOOKINGS-SQL] Booking cancelled: ${bookingId}`);
    
    return c.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking cancelled successfully'
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-BOOKINGS-SQL] Error cancelling booking:', error);
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
    
    console.log(`✅ [VENDOR-BOOKINGS-SQL] Completing booking: ${bookingId}`);
    
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    const updatedBooking = await bookingsRepo.findById(bookingId);
    
    console.log(`✅ [VENDOR-BOOKINGS-SQL] Booking completed: ${bookingId}`);
    
    return c.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking marked as completed'
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-BOOKINGS-SQL] Error completing booking:', error);
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
    
    console.log(`📜 [VENDOR-SQL] Fetching customer history for: ${cleanPhone}`);
    
    // ✅ SQL: Find customer by phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        history: [],
        total: 0
      });
    }
    
    // ✅ SQL: Get customer's bookings
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByCustomer(customer.id);
    
    // Transform to history format
    const history = bookings.map((b: any) => ({
      id: b.id,
      serviceName: b.service_name || 'Service',
      serviceType: b.service_type,
      vendorName: null, // Will need to join with vendors table if needed
      petName: null, // Will need to join with pets table if needed
      status: b.status,
      selectedDate: b.booking_date,
      selectedTime: b.booking_time,
      createdAt: b.created_at,
      completedAt: b.completed_at
    }));
    
    // Sort by date (newest first)
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`✅ [VENDOR-SQL] Found ${history.length} bookings for customer: ${cleanPhone}`);
    
    return c.json({
      success: true,
      history,
      total: history.length
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-SQL] Error fetching customer history:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;

