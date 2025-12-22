/**
 * ============================================================================
 * BOOKING ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { withTransaction } from "../../lib/db.ts";

/**
 * SQL-ONLY Booking Endpoints
 * 
 * ❌ NO KV USAGE - All operations use SQL repositories
 */
export function bookingEndpoints(app: Hono) {
  
  // Helper: Trigger Notification using SQL repository
  async function triggerNotification(notification: {
    recipientId: string;
    recipientType: 'customer' | 'vendor' | 'staff' | 'admin';
    type: string;
    title: string;
    message: string;
    channels?: any;
    data?: any;
  }) {
    try {
      await getNotificationsRepository().create({
        recipient_type: notification.recipientType,
        recipient_id: notification.recipientId,
        notification_type: notification.type,
        title: notification.title,
        message: notification.message,
        channels: notification.channels || { email: true, sms: true, inApp: true, push: false },
        data: notification.data,
      });
      
      console.log(`📨 Notification created for ${notification.recipientType}:${notification.recipientId}`);
      
      // TODO: Integrate with AWS SNS/SES for email/SMS delivery
    } catch (e) {
      console.error('Failed to create notification:', e);
    }
  }

  // ============================================
  // CUSTOMER BOOKING ENDPOINTS
  // ============================================
  
  /**
   * Create a new booking
   * POST /make-server-3dd53475/bookings/create
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/bookings/create", async (c) => {
    try {
      const {
        customerId,
        vendorId,
        petId,
        serviceId,
        serviceName,
        serviceType,
        bookingDate,
        bookingTime,
        duration,
        price,
        customerName,
        customerPhone,
        customerAddress,
        petName,
        petBreed,
        petAge,
        numberOfPax,
        specialInstructions,
        paymentMethod,
        checkInDate,
        checkOutDate,
        bookingType,
        tableId,
        partyPackageId
      } = await c.req.json();

      // Validate required fields
      if (!customerId || !vendorId || !serviceId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Calculate duration for stays
      let calculatedDuration = duration || 60;
      let stayNights = 0;

      if (checkInDate && checkOutDate) {
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        stayNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (stayNights < 1) stayNights = 1;
      }

      // ✅ SQL: Get vendor to check if solo provider
      let assignedStaffId = null;
      let autoAssigned = false;
      
      const vendor = await getVendorsRepository().findById(vendorId);
      
      if (vendor) {
        // Check if solo provider (this would be a vendor attribute)
        // For now, we'll check if vendor has only one staff member
        const staffList = await getStaffRepository().findByVendor(vendorId);
        if (staffList.length === 1) {
          assignedStaffId = staffList[0].id;
          autoAssigned = true;
          console.log(`   ✅ Auto-assigned to solo provider staff: ${assignedStaffId}`);
        }
      }

      // ✅ SQL: Create booking using repository
      const booking = await getBookingsRepository().create({
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: assignedStaffId || undefined,
        service_id: serviceId,
        booking_date: bookingDate || checkInDate || new Date().toISOString().split('T')[0],
        booking_time: bookingTime || '12:00',
        service_type: serviceType || 'appointment',
        address: customerAddress || undefined,
        base_price: price || 0,
        total_amount: price || 0,
        payment_status: 'pending',
        notes: specialInstructions || undefined,
      });

      // TRIGGER NOTIFICATIONS
      // 1. Notify Vendor
      await triggerNotification({
        recipientId: vendorId,
        recipientType: 'vendor',
        type: 'booking_created',
        title: 'New Booking Request',
        message: `New booking request from ${customerName} for ${serviceName} on ${bookingDate} at ${bookingTime}`,
        data: { bookingId: booking.id, serviceName, customerName, bookingDate, bookingTime },
      });

      // 2. Notify Customer
      await triggerNotification({
        recipientId: customerId,
        recipientType: 'customer',
        type: 'booking_created',
        title: 'Booking Requested',
        message: `Your booking for ${serviceName} is pending confirmation.`,
        data: { bookingId: booking.id, serviceName, vendorId },
      });

      console.log(`✅ Booking created: ${booking.id}`);
      return c.json({ success: true, bookingId: booking.id, booking });
    } catch (error) {
      console.error('Error creating booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get booking details
   * GET /make-server-3dd53475/bookings/:bookingId
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/bookings/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      return c.json({ booking });
    } catch (error) {
      console.error('Error getting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get customer's bookings
   * GET /make-server-3dd53475/bookings/customer/:customerId
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/bookings/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');
      
      // ✅ SQL: Get bookings from repository
      const bookings = await getBookingsRepository().findByCustomer(customerId, {
        status: status || undefined,
      });
      
      return c.json({ bookings, total: bookings.length });
    } catch (error) {
      console.error('Error getting customer bookings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor's bookings
   * GET /make-server-3dd53475/bookings/vendor/:vendorId
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/bookings/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');
      
      // ✅ SQL: Get bookings from repository
      const bookings = await getBookingsRepository().findByVendor(vendorId, {
        status: status || undefined,
      });
      
      return c.json({ bookings, total: bookings.length });
    } catch (error) {
      console.error('Error getting vendor bookings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update booking status (Vendor)
   * POST /make-server-3dd53475/bookings/:bookingId/status
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, note, updatedBy } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Valid status transitions
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      // ✅ SQL: Update booking status
      let updatedBooking;
      if (status === 'confirmed') {
        updatedBooking = await getBookingsRepository().confirm(bookingId);
      } else if (status === 'completed') {
        updatedBooking = await getBookingsRepository().complete(bookingId);
      } else if (status === 'cancelled') {
        updatedBooking = await getBookingsRepository().cancel(bookingId, note || 'Cancelled');
      } else {
        updatedBooking = await getBookingsRepository().update(bookingId, {
          status,
          notes: note || undefined,
        });
      }

      // Special handling for completed bookings
      if (status === 'completed') {
        // ✅ SQL: Update vendor stats (would need vendor repository update method)
        const vendor = await getVendorsRepository().findById(booking.vendor_id || '');
        if (vendor) {
          // TODO: Add vendor stats update method to repository
          // For now, this would be handled by a separate stats aggregation
        }

        // ✅ LOYALTY INTEGRATION: Award points for completed booking
        try {
          console.log(`[LOYALTY] Triggering points for completed booking ${bookingId}`);
          
          let actionKey = 'book_grooming';
          const serviceType = booking.service_type?.toLowerCase() || '';
          
          if (serviceType.includes('vet') || serviceType.includes('consultation')) {
            actionKey = 'book_vet';
          } else if (serviceType.includes('food') || serviceType.includes('nutrition')) {
            actionKey = 'buy_food';
          } else if (serviceType.includes('groom')) {
            actionKey = 'book_grooming';
          }

          // Award loyalty points (external API call)
          const loyaltyResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/loyalty/process-action`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: booking.customer_id,
                userType: 'customer',
                actionKey,
                amount: booking.total_amount || 0,
                metadata: { bookingId, serviceType: booking.service_type }
              })
            }
          ).catch(err => {
            console.error('[LOYALTY] Failed to award points:', err);
            return null;
          });

          if (loyaltyResponse?.ok) {
            const data = await loyaltyResponse.json();
            console.log(`✅ [LOYALTY] Awarded ${data.pointsAwarded} points to customer ${booking.customer_id}`);
          }
        } catch (loyaltyErr) {
          console.error('[LOYALTY] Error processing loyalty points:', loyaltyErr);
        }
      }

      // Notify Customer of status change
      if (status !== 'pending') {
        await triggerNotification({
          recipientId: booking.customer_id,
          recipientType: 'customer',
          type: 'booking_status_change',
          title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your booking is now ${status}. ${note || ''}`,
          data: { bookingId, status, note },
        });
      }

      console.log(`✅ Booking ${bookingId} status updated to ${status}`);
      return c.json({ success: true, booking: updatedBooking });
    } catch (error) {
      console.error('Error updating booking status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Cancel booking
   * POST /make-server-3dd53475/bookings/:bookingId/cancel
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/cancel", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { reason, cancelledBy, refundAmount } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return c.json({ error: 'Cannot cancel this booking' }, 400);
      }

      // ✅ SQL: Cancel booking
      const cancelledBooking = await getBookingsRepository().cancel(bookingId, reason || 'Cancelled by user');

      // Notify other party
      const recipientType = cancelledBy === booking.customer_id ? 'vendor' : 'customer';
      const recipientId = cancelledBy === booking.customer_id 
        ? (booking.vendor_id || '') 
        : booking.customer_id;
      
      await triggerNotification({
        recipientId,
        recipientType,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Booking has been cancelled. Reason: ${reason}`,
        data: { bookingId, reason },
      });

      console.log(`✅ Booking ${bookingId} cancelled`);
      return c.json({ success: true, booking: cancelledBooking });
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reschedule booking
   * POST /make-server-3dd53475/bookings/:bookingId/reschedule
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/reschedule", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { newDate, newTime, reason } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return c.json({ error: 'Cannot reschedule this booking' }, 400);
      }

      // ✅ SQL: Reschedule booking using repository method
      const rescheduledBooking = await getBookingsRepository().reschedule(
        bookingId,
        newDate,
        newTime
      );

      console.log(`✅ Booking ${bookingId} rescheduled`);
      return c.json({ success: true, booking: rescheduledBooking });
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get booking statistics for vendor
   * GET /make-server-3dd53475/bookings/vendor/:vendorId/stats
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.get("/make-server-3dd53475/bookings/vendor/:vendorId/stats", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get all bookings for vendor
      const bookings = await getBookingsRepository().findByVendor(vendorId);
      
      let pending = 0, confirmed = 0, completed = 0, cancelled = 0;
      let totalRevenue = 0;
      
      bookings.forEach(booking => {
        switch (booking.status) {
          case 'pending': pending++; break;
          case 'confirmed': confirmed++; break;
          case 'completed': 
            completed++; 
            totalRevenue += booking.total_amount;
            break;
          case 'cancelled': cancelled++; break;
        }
      });
      
      return c.json({ 
        stats: {
          total: bookings.length,
          pending,
          confirmed,
          completed,
          cancelled,
          totalRevenue
        }
      });
    } catch (error) {
      console.error('Error getting booking stats:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Accept booking (Vendor confirms)
   * POST /make-server-3dd53475/bookings/:bookingId/accept
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/accept", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, note } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending') {
        return c.json({ error: 'Booking is not in pending status' }, 400);
      }

      // ✅ SQL: Confirm booking
      const confirmedBooking = await getBookingsRepository().confirm(bookingId);

      // ✅ SQL: Get customer and vendor for notification
      const customer = await getCustomersRepository().findById(booking.customer_id);
      const vendor = await getVendorsRepository().findById(vendorId);

      // ✅ SQL: Create notification
      await triggerNotification({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_confirmed',
        title: 'Booking Confirmed!',
        message: `Your booking has been confirmed!`,
        data: { 
          bookingId, 
          serviceName: booking.service_type, 
          bookingDate: booking.booking_date, 
          bookingTime: booking.booking_time,
          vendorName: vendor?.business_name 
        },
      });

      console.log(`✅ Booking ${bookingId} accepted by vendor`);
      return c.json({ success: true, booking: confirmedBooking });
    } catch (error) {
      console.error('Error accepting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reject booking (Vendor declines)
   * POST /make-server-3dd53475/bookings/:bookingId/reject
   * 
   * REFACTORED: Uses SQL repository instead of KV
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/reject", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending') {
        return c.json({ error: 'Booking is not in pending status' }, 400);
      }

      // ✅ SQL: Cancel booking (rejection = cancellation)
      const cancelledBooking = await getBookingsRepository().cancel(
        bookingId,
        reason || 'Rejected by vendor'
      );

      // Notify Customer
      await triggerNotification({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_cancelled',
        title: 'Booking Declined',
        message: `Your booking was declined. Reason: ${reason}`,
        data: { bookingId, reason },
      });

      console.log(`✅ Booking ${bookingId} rejected by vendor`);
      return c.json({ success: true, booking: cancelledBooking });
    } catch (error) {
      console.error('Error rejecting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Booking endpoints registered (SQL-only)');
}

